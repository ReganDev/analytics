import { useCallback, useEffect, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import AnalyticsView from '../components/analytics/AnalyticsView'
import Brand from '../components/Brand'
import SiteTabs from '../components/SiteTabs'
import ThemeToggle from '../components/ThemeToggle'
import type { AnalyticsReport, Range } from '../lib/analytics'
import { busyReport, emptyReport } from './fixtures'

/**
 * Local UI harness for the Analytics tab: the real components inside a copy of
 * the signed-in chrome, fed by live Vercel data (via server/harnessPlugin.ts)
 * or sample data. No Supabase, no login. Dev server only:
 * http://localhost:5173/dev/analytics.html
 */

type Source = 'live' | 'busy' | 'empty' | 'error' | 'loading'

interface Project {
  id: string
  name: string
  url: string | null
}

interface Live {
  report: AnalyticsReport | null
  loading: boolean
  error: string
  updatedAt: Date | null
}

const SOURCES: { value: Source; label: string }[] = [
  { value: 'live', label: 'Live (Vercel)' },
  { value: 'busy', label: 'Sample: busy site' },
  { value: 'empty', label: 'Sample: no visits' },
  { value: 'error', label: 'Sample: API down' },
  { value: 'loading', label: 'Sample: first load' },
]

const params = new URLSearchParams(window.location.search)
const openedAt = new Date()

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as T
}

export default function AnalyticsHarness() {
  const [source, setSource] = useState<Source>((params.get('source') as Source) ?? 'live')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(params.get('project') ?? 'msa')
  const [range, setRange] = useState<Range>('30d')
  const [live, setLive] = useState<Live>({ report: null, loading: false, error: '', updatedAt: null })

  useEffect(() => {
    getJson<Project[]>('/__harness/projects')
      .then((list) => {
        setProjects(list)
        // Accept a project name in the URL, but select by id.
        setProjectId((current) => list.find((p) => p.id === current || p.name === current)?.id ?? current)
      })
      .catch((e: Error) => setLive((s) => ({ ...s, error: e.message })))
  }, [])

  const load = useCallback(() => {
    setLive((s) => ({ ...s, loading: true, error: '' }))
    getJson<AnalyticsReport>(`/__harness/report?project=${encodeURIComponent(projectId)}&range=${range}`)
      .then((report) => setLive({ report, loading: false, error: '', updatedAt: new Date() }))
      .catch((e: Error) => setLive((s) => ({ ...s, loading: false, error: e.message })))
  }, [projectId, range])

  useEffect(() => {
    if (source === 'live') load()
  }, [source, load])

  // Keep the URL shareable: ?source=busy&project=msa
  useEffect(() => {
    const next = new URLSearchParams({ source, project: projectId })
    window.history.replaceState(null, '', `?${next}`)
  }, [source, projectId])

  const project = projects.find((p) => p.id === projectId)
  const sample = (report: AnalyticsReport | null, extra: Partial<Live> = {}): Live => ({
    report,
    loading: false,
    error: '',
    updatedAt: openedAt,
    ...extra,
  })
  const view =
    source === 'live' ? live
    : source === 'busy' ? sample(busyReport(range))
    : source === 'empty' ? sample(emptyReport(range))
    : source === 'error' ? sample(null, { error: 'Vercel API returned 503' })
    : sample(null, { loading: true })

  // In the portal this is the site's name from Admin; the harness fakes it.
  const siteName =
    source !== 'live' || project?.name === 'msa' ? 'Orpington Osteopaths'
    : project ? (project.url?.replace(/^https:\/\//, '') ?? project.name)
    : projectId

  return (
    <MemoryRouter initialEntries={['/s/preview']}>
      <div className="shell">
        <header className="topbar">
          <span className="brand brand--bar">
            <Brand />
          </span>
          <span className="topbar__divider" aria-hidden="true">
            /
          </span>
          <span className="topbar__site topbar__site--static">{siteName}</span>
          <SiteTabs siteSlug="preview" analytics inline />
          <span className="topbar__spacer" />
          {project?.url && source === 'live' && (
            <a className="topbar__visit" href={project.url} target="_blank" rel="noreferrer">
              View website ↗
            </a>
          )}
          <ThemeToggle />
          <span className="topbar__user">msaknight2000@gmail.com</span>
          <button className="button button--ghost button--small" disabled>
            Sign out
          </button>
        </header>

        <main className="page page--board">
          <AnalyticsView
            range={range}
            onRangeChange={setRange}
            report={view.report}
            loading={view.loading}
            error={view.error}
            onRetry={source === 'live' ? load : () => undefined}
            updatedAt={view.updatedAt}
          />
        </main>

        <div className="harness" role="region" aria-label="Dev harness controls">
          <strong>Harness</strong>
          <label className="harness__field">
            Data
            <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {source === 'live' && (
            <label className="harness__field">
              Project
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.length === 0 && <option value={projectId}>{projectId}</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.url ? ` · ${p.url.replace(/^https:\/\//, '')}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {source === 'live' && live.error && <span className="harness__error">{live.error}</span>}
        </div>
      </div>
    </MemoryRouter>
  )
}
