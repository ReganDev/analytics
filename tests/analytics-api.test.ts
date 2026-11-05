import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import analytics, { clearCache } from '../api/analytics.ts'

const SUPABASE = 'https://db.example.supabase.co'

interface Fake {
  /** What PostgREST returns for the sites lookup. */
  site: { status: number; rows?: { vercel_project_id: string | null }[] }
  calls: { url: string; auth: string | null; apikey: string | null }[]
}

function fakeFetch(fake: Fake) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    fake.calls.push({ url, auth: headers.get('authorization'), apikey: headers.get('apikey') })
    if (url.startsWith(`${SUPABASE}/rest/v1/sites`)) {
      return new Response(JSON.stringify(fake.site.rows ?? { message: 'JWT expired' }), { status: fake.site.status })
    }
    if (url.startsWith('https://api.vercel.com/v1/query/web-analytics/visits/aggregate')) {
      const by = new URL(url).searchParams.get('by')
      const data =
        by === 'environment' ? [{ environment: 'production', visitors: 16, pageviews: 26 }]
        : by === 'day' ? [{ timestamp: '2026-10-28T00:00:00.000Z', visitors: 16, pageviews: 26 }]
        : [{ [by!]: by === 'requestPath' ? '/' : '', visitors: 16, pageviews: 26 }]
      return new Response(JSON.stringify({ version: 1, data }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

const call = (query: string, init: RequestInit = {}) =>
  analytics.fetch(new Request(`https://portal.test/api/analytics?${query}`, init))

const asUser = { headers: { Authorization: 'Bearer user-jwt' } }

let fake: Fake

beforeEach(() => {
  clearCache()
  fake = { site: { status: 200, rows: [{ vercel_project_id: 'prj_msa' }] }, calls: [] }
  vi.stubGlobal('fetch', fakeFetch(fake))
  vi.stubEnv('VITE_SUPABASE_URL', SUPABASE)
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
  vi.stubEnv('VERCEL_TOKEN', 'vercel-secret')
  vi.stubEnv('VERCEL_TEAM_ID', 'team_1')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/analytics', () => {
  it('rejects requests with no session', async () => {
    const res = await call('site=orpington-osteopaths')
    expect(res.status).toBe(401)
    expect(fake.calls).toHaveLength(0)
  })

  it('rejects anything but GET', async () => {
    const res = await call('site=orpington-osteopaths', { ...asUser, method: 'POST' })
    expect(res.status).toBe(405)
  })

  it('refuses slugs that could smuggle a PostgREST filter', async () => {
    const res = await call(`site=${encodeURIComponent('x&slug=neq.x')}`, asUser)
    expect(res.status).toBe(400)
    expect(fake.calls).toHaveLength(0)
  })

  it('looks the site up as the caller, with their own JWT', async () => {
    await call('site=orpington-osteopaths', asUser)
    const lookup = fake.calls[0]
    expect(lookup.url).toBe(`${SUPABASE}/rest/v1/sites?select=vercel_project_id&slug=eq.orpington-osteopaths`)
    expect(lookup.auth).toBe('Bearer user-jwt')
    expect(lookup.apikey).toBe('anon-key')
  })

  it('treats an expired or invalid session as signed out', async () => {
    fake.site = { status: 401 }
    const res = await call('site=orpington-osteopaths', asUser)
    expect(res.status).toBe(401)
    expect(fake.calls.some((c) => c.url.includes('vercel.com'))).toBe(false)
  })

  it('answers 404, and never calls Vercel, for a site the caller cannot see', async () => {
    fake.site = { status: 200, rows: [] }
    const res = await call('site=ka-studio', asUser)
    expect(res.status).toBe(404)
    expect(fake.calls.some((c) => c.url.includes('vercel.com'))).toBe(false)
  })

  it('says when a site has no Vercel project linked', async () => {
    fake.site = { status: 200, rows: [{ vercel_project_id: null }] }
    const res = await call('site=orpington-osteopaths', asUser)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'not_connected' })
  })

  it('reads the project from the database, never from the request', async () => {
    const res = await call('site=orpington-osteopaths&projectId=prj_someone_else', asUser)
    expect(res.status).toBe(200)
    const vercel = fake.calls.filter((c) => c.url.includes('vercel.com'))
    expect(vercel).toHaveLength(6)
    for (const c of vercel) {
      expect(new URL(c.url).searchParams.get('projectId')).toBe('prj_msa')
      expect(c.auth).toBe('Bearer vercel-secret')
    }
  })

  it('never sends the Vercel token anywhere but Vercel', async () => {
    await call('site=orpington-osteopaths', asUser)
    for (const c of fake.calls.filter((c) => !c.url.includes('vercel.com'))) {
      expect(c.auth).not.toContain('vercel-secret')
    }
  })

  it('returns the shaped report and keeps it out of shared caches', async () => {
    const res = await call('site=orpington-osteopaths&range=7d', asUser)
    expect(res.headers.get('cache-control')).toContain('private')
    const report = (await res.json()) as { pages: unknown[] }
    expect(report).toMatchObject({ range: '7d', totals: { visitors: 16, pageviews: 26 } })
    expect(report.pages[0]).toEqual({ key: '/', visitors: 16, pageviews: 26 })
  })

  it('reuses a recent report instead of calling Vercel again', async () => {
    await call('site=orpington-osteopaths', asUser)
    await call('site=orpington-osteopaths', asUser)
    expect(fake.calls.filter((c) => c.url.includes('vercel.com'))).toHaveLength(6)
    // The access check still runs every time.
    expect(fake.calls.filter((c) => c.url.includes('/rest/v1/sites'))).toHaveLength(2)
  })

  it('hides Vercel’s own error text from the client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) =>
        String(input).includes('vercel.com') ?
          new Response(JSON.stringify({ error: { message: 'the hobby plan only grants access to…' } }), { status: 400 })
        : new Response(JSON.stringify([{ vercel_project_id: 'prj_msa' }]), { status: 200 }),
      ),
    )
    const res = await call('site=orpington-osteopaths', asUser)
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('hobby')
  })

  it('fails closed when it isn’t configured', async () => {
    vi.stubEnv('VERCEL_TOKEN', '')
    const res = await call('site=orpington-osteopaths', asUser)
    expect(res.status).toBe(500)
    expect(fake.calls).toHaveLength(0)
  })
})
