/**
 * GET /api/analytics?site=<slug>&range=7d|30d
 * Authorization: Bearer <the client's Supabase access token>
 *
 * Returns one site's Vercel Web Analytics as an AnalyticsReport. Two rules
 * keep each client inside their own numbers:
 *
 *   1. The browser only names a site. The Vercel project id is looked up in
 *      Supabase *as the caller*, so row-level security answers "may this
 *      person see this site?" exactly as it does for blog posts. A site the
 *      caller isn't a member of looks the same as one that doesn't exist.
 *   2. VERCEL_TOKEN can read every project in the team, so it stays here on
 *      the server and is never sent to the browser or put in a VITE_ variable.
 *
 * This file must stay self-contained. Vercel transpiles each file under api/
 * on its own rather than bundling it, so a relative import reaching outside
 * api/ points at a file that was never emitted and the function dies with
 * ERR_MODULE_NOT_FOUND (see the Knight Osteopathy contact function). The one
 * import below is type-only and erased at compile time.
 *
 * Environment (Vercel → Project → Settings → Environment Variables):
 *   VERCEL_TOKEN     a Vercel access token for the team
 *   VERCEL_TEAM_ID   the team that owns the client projects
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   already set for the app
 */
import type { AnalyticsReport, BreakdownRow, Counts, Range } from '../src/lib/analytics.ts'

const VERCEL_API = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate'
const DAYS: Record<Range, number> = { '7d': 7, '30d': 30 }
const TOP = 10
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Web Analytics updates within minutes; five minutes keeps Vercel calls low without going stale. */
const CACHE_MS = 5 * 60 * 1000

export class VercelApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface Scope {
  token: string
  teamId: string
  projectId: string
}

type Row = Record<string, string | number>

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** The last `days` whole UTC days, ending today. Hobby keeps 31, so 30 is the most we ask for. */
export function rangeDates(range: Range, now = new Date()) {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const since = new Date(until)
  since.setUTCDate(since.getUTCDate() - (DAYS[range] - 1))
  return { since: isoDay(since), until: isoDay(until) }
}

async function aggregate(scope: Scope, params: Record<string, string>): Promise<Row[]> {
  const url = new URL(VERCEL_API)
  url.search = new URLSearchParams({ projectId: scope.projectId, teamId: scope.teamId, ...params }).toString()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${scope.token}` },
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => null)) as { data?: Row[]; error?: { message?: string } } | null
  if (!res.ok) throw new VercelApiError(res.status, body?.error?.message ?? `Vercel API returned ${res.status}`)
  return body?.data ?? []
}

const counts = (row: Row): Counts => ({
  visitors: Number(row.visitors ?? 0),
  pageviews: Number(row.pageviews ?? 0),
})

const breakdown = (rows: Row[], dimension: string): BreakdownRow[] =>
  rows
    .map((row) => ({ key: String(row[dimension] ?? ''), ...counts(row) }))
    .sort((a, b) => b.visitors - a.visitors || b.pageviews - a.pageviews)

export async function fetchAnalyticsReport(scope: Scope, range: Range, now = new Date()): Promise<AnalyticsReport> {
  const { since, until } = rangeDates(range, now)
  const trendSince = rangeDates('30d', now).since
  // Explicit instants, not bare dates: without a time granularity Vercel reads
  // `until=2026-10-28` as the *start* of that day, which drops today's visits
  // from the totals and lists while the day-by-day query still includes them.
  const window = { since: `${since}T00:00:00.000Z`, until: now.toISOString() }
  const top = (by: string) => aggregate(scope, { ...window, by, limit: String(TOP) })

  const [totals, daily, pages, referrers, devices, countries] = await Promise.all([
    // Grouping by environment (production only, by default) yields one row:
    // the range total in a single call.
    aggregate(scope, { ...window, by: 'environment' }),
    // Always the full 30 days, whatever the range: the week-on-week figure
    // needs the 7 days before the last 7.
    aggregate(scope, { since: `${trendSince}T00:00:00.000Z`, until: window.until, by: 'day' }),
    top('requestPath'),
    top('referrerHostname'),
    top('deviceType'),
    top('country'),
  ])

  return {
    range,
    since,
    until,
    totals: totals[0] ? counts(totals[0]) : { visitors: 0, pageviews: 0 },
    // Vercel zero-fills missing days, but can return the partial day after
    // `until` when it rounds to the granularity; keep only the 30 days.
    daily: daily
      .map((row) => ({ date: String(row.timestamp).slice(0, 10), ...counts(row) }))
      .filter((d) => d.date >= trendSince && d.date <= until),
    pages: breakdown(pages, 'requestPath'),
    referrers: breakdown(referrers, 'referrerHostname'),
    devices: breakdown(devices, 'deviceType'),
    countries: breakdown(countries, 'country'),
  }
}

// ---------- request handling ----------

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...headers },
  })

/** Per-instance memo, keyed by project and range. Lost on cold start, which is fine. */
const cache = new Map<string, { at: number; report: AnalyticsReport }>()

/** Tests only. */
export const clearCache = () => cache.clear()

function env() {
  return {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    vercelToken: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
  }
}

/**
 * The caller's view of one site, via PostgREST with their own JWT. Row-level
 * security returns the row only to its members and admins.
 */
async function siteProject(supabaseUrl: string, anonKey: string, jwt: string, slug: string) {
  const url = `${supabaseUrl}/rest/v1/sites?select=vercel_project_id&slug=eq.${encodeURIComponent(slug)}`
  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 401 || res.status === 403) return { status: 'unauthorised' as const }
  if (!res.ok) return { status: 'error' as const }
  const rows = (await res.json()) as { vercel_project_id: string | null }[]
  if (rows.length === 0) return { status: 'missing' as const }
  return { status: 'ok' as const, projectId: rows[0].vercel_project_id }
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'Use GET.' }, { Allow: 'GET' })

  const url = new URL(request.url)
  const slug = url.searchParams.get('site') ?? ''
  const range: Range = url.searchParams.get('range') === '7d' ? '7d' : '30d'
  // Validated before it goes anywhere near a PostgREST filter.
  if (!SLUG.test(slug)) return json(400, { error: 'Unknown site.' })

  const jwt = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!jwt) return json(401, { error: 'Sign in to see analytics.' })

  const { supabaseUrl, anonKey, vercelToken, teamId } = env()
  if (!supabaseUrl || !anonKey || !vercelToken || !teamId) {
    console.error('analytics: missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VERCEL_TOKEN or VERCEL_TEAM_ID')
    return json(500, { error: 'Analytics isn’t set up yet.' })
  }

  const site = await siteProject(supabaseUrl, anonKey, jwt, slug)
  if (site.status === 'unauthorised') return json(401, { error: 'Your session has expired. Sign in again.' })
  if (site.status === 'error') return json(502, { error: 'Couldn’t check your access. Try again in a minute.' })
  if (site.status === 'missing') return json(404, { error: 'Unknown site.' })
  if (!site.projectId) return json(409, { error: 'Analytics isn’t connected for this site yet.', code: 'not_connected' })

  const key = `${site.projectId}:${range}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return json(200, hit.report)

  try {
    const report = await fetchAnalyticsReport({ token: vercelToken, teamId, projectId: site.projectId }, range)
    cache.set(key, { at: Date.now(), report })
    return json(200, report)
  } catch (error) {
    // Vercel's own message stays in the logs; it can name projects and plans.
    console.error('analytics: Vercel request failed', site.projectId, error)
    return json(502, { error: 'Vercel didn’t return your stats. Try again in a minute.' })
  }
}

/**
 * A project with no framework needs a default export exposing `fetch`; named
 * method exports (`export function GET`) are the Next.js convention.
 */
export default {
  fetch: handleRequest,
}
