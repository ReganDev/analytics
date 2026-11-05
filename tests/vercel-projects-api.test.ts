import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import vercelProjects from '../api/vercel-projects.ts'

const SUPABASE = 'https://db.example.supabase.co'
let admin = true
let vercelCalls = 0

beforeEach(() => {
  admin = true
  vercelCalls = 0
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE)
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('VERCEL_TOKEN', 'vercel-secret')
  vi.stubEnv('VERCEL_TEAM_ID', 'team_1')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url === `${SUPABASE}/rest/v1/rpc/is_admin`) return new Response(JSON.stringify(admin))
      vercelCalls++
      return new Response(
        JSON.stringify({
          projects: [
            { id: 'prj_b', name: 'msa', targets: { production: { alias: ['www.orpingtonosteopaths.com', 'msa.vercel.app'] } } },
            { id: 'prj_a', name: 'kastudio', targets: { production: { alias: ['kastudio.vercel.app'] } } },
          ],
        }),
      )
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const call = (init: RequestInit = {}) =>
  vercelProjects.fetch(new Request('https://portal.test/api/vercel-projects', init))

describe('GET /api/vercel-projects', () => {
  it('needs a session', async () => {
    expect((await call()).status).toBe(401)
  })

  it('is closed to clients, and never touches Vercel for them', async () => {
    admin = false
    const res = await call({ headers: { Authorization: 'Bearer client-jwt' } })
    expect(res.status).toBe(403)
    expect(vercelCalls).toBe(0)
  })

  it('lists projects by name for admins, with the primary domain', async () => {
    const res = await call({ headers: { Authorization: 'Bearer admin-jwt' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 'prj_a', name: 'kastudio', url: 'https://kastudio.vercel.app' },
      { id: 'prj_b', name: 'msa', url: 'https://www.orpingtonosteopaths.com' },
    ])
  })
})
