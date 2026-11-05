/**
 * GET /api/vercel-projects
 * Authorization: Bearer <an admin's Supabase access token>
 *
 * Lists the team's Vercel projects for the Admin screen's "Vercel project"
 * dropdown. Admins only: the caller's JWT is checked with the database's own
 * is_admin() before the token is used.
 *
 * Self-contained for the same reason as api/analytics.ts: Vercel transpiles
 * api/ files one by one, so relative imports out of api/ break at runtime.
 */

export interface VercelProject {
  id: string
  name: string
  url: string | null
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  })

/** Projects in the team, by name, each with its primary production domain. */
export async function listProjects(token: string, teamId: string): Promise<VercelProject[]> {
  const url = new URL('https://api.vercel.com/v10/projects')
  url.search = new URLSearchParams({ teamId, limit: '100' }).toString()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => null)) as {
    projects?: { id: string; name: string; targets?: { production?: { alias?: string[] } } }[]
    error?: { message?: string }
  } | null
  if (!res.ok) throw new Error(body?.error?.message ?? `Vercel API returned ${res.status}`)
  return (body?.projects ?? [])
    .map((p) => {
      // The first alias is the domain the others redirect to.
      const aliases = p.targets?.production?.alias ?? []
      const alias = aliases.find((a) => !a.endsWith('.vercel.app')) ?? aliases[0]
      return { id: p.id, name: p.name, url: alias ? `https://${alias}` : null }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function isAdmin(supabaseUrl: string, anonKey: string, jwt: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(10_000),
  })
  return res.ok && (await res.json()) === true
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'Use GET.' })

  const jwt = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!jwt) return json(401, { error: 'Sign in first.' })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!supabaseUrl || !anonKey || !token || !teamId) {
    console.error('vercel-projects: missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VERCEL_TOKEN or VERCEL_TEAM_ID')
    return json(500, { error: 'Analytics isn’t set up yet.' })
  }

  if (!(await isAdmin(supabaseUrl, anonKey, jwt))) return json(403, { error: 'Admins only.' })

  try {
    return json(200, await listProjects(token, teamId))
  } catch (error) {
    console.error('vercel-projects: Vercel request failed', error)
    return json(502, { error: 'Couldn’t load your Vercel projects.' })
  }
}

export default {
  fetch: handleRequest,
}
