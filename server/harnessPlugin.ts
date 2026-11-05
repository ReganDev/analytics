/**
 * Dev-only Vite plugin (`apply: 'serve'`, so never part of a build). It does two jobs:
 *
 *   1. Runs the real api/ functions under `npm run dev`, so the signed-in
 *      portal works locally exactly as on Vercel: /api/analytics,
 *      /api/vercel-projects.
 *   2. Serves the UI harness (/dev/analytics.html) through /__harness/*:
 *      live Vercel data with no Supabase or login at all.
 *
 * Credentials, first match wins:
 *   - VERCEL_TOKEN / VERCEL_TEAM_ID in .env.local (never VITE_-prefixed)
 *   - otherwise the Vercel CLI's own login (`vercel login`) on this machine
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import analytics, { VercelApiError, fetchAnalyticsReport } from '../api/analytics.ts'
import vercelProjects, { listProjects } from '../api/vercel-projects.ts'

const API: Record<string, { fetch: (request: Request) => Promise<Response> }> = {
  '/analytics': analytics,
  '/vercel-projects': vercelProjects,
}

function readCliJson(file: string): Record<string, unknown> {
  const dirs = [
    join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'com.vercel.cli'),
    join(homedir(), 'Library', 'Application Support', 'com.vercel.cli'),
  ]
  for (const dir of dirs) {
    try {
      return JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch {
      // try the next location
    }
  }
  return {}
}

/** The api/ functions read process.env, as on Vercel; fill it from .env.local and the CLI login. */
function prepareEnv(fileEnv: Record<string, string>) {
  for (const [key, value] of Object.entries(fileEnv)) process.env[key] ??= value
  process.env.VERCEL_TOKEN ||= String(readCliJson('auth.json').token ?? '')
  process.env.VERCEL_TEAM_ID ||= String(readCliJson('config.json').currentTeam ?? '')
}

function credentials() {
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token || !teamId) {
    throw new VercelApiError(
      500,
      'No Vercel credentials. Run `vercel login`, or set VERCEL_TOKEN and VERCEL_TEAM_ID in .env.local.',
    )
  }
  return { token, teamId }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function analyticsHarness(): Plugin {
  return {
    name: 'analytics-harness',
    apply: 'serve',
    configResolved(config) {
      prepareEnv(loadEnv(config.mode, config.envDir || process.cwd(), ''))
    },
    configureServer(server) {
      // 1. The real functions, adapted from Node's request to a Web Request.
      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const fn = API[url.pathname]
        if (!fn) return next()
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(key, value)
        }
        const response = await fn.fetch(
          // Connect strips the /api mount from req.url; originalUrl keeps it.
          new Request(new URL((req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/', 'http://localhost'), {
            method: req.method,
            headers,
          }),
        )
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await response.text())
      })

      // 2. The harness: no login, any project.
      server.middlewares.use('/__harness', async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://harness')
        try {
          const { token, teamId } = credentials()
          if (url.pathname === '/projects') {
            return send(res, 200, await listProjects(token, teamId))
          }
          if (url.pathname === '/report') {
            const projectId = url.searchParams.get('project')
            const range = url.searchParams.get('range') === '7d' ? '7d' : '30d'
            if (!projectId) return send(res, 400, { error: 'Pass ?project=<id or name>' })
            return send(res, 200, await fetchAnalyticsReport({ token, teamId, projectId }, range))
          }
          send(res, 404, { error: 'Unknown harness endpoint' })
        } catch (error) {
          const status = error instanceof VercelApiError ? error.status : 500
          send(res, status, { error: error instanceof Error ? error.message : String(error) })
        }
      })
    },
  }
}
