import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import AnalyticsView from '../components/analytics/AnalyticsView'
import Shell from '../components/Shell'
import type { Range } from '../lib/analytics'
import { useAnalytics } from '../lib/useAnalytics'
import { useSites } from '../lib/useSites'

/** A site's landing page: its analytics, or straight to the blog if none are linked. */
export default function SiteAnalytics() {
  const { siteSlug } = useParams<{ siteSlug: string }>()
  const { sites } = useSites()
  const site = sites?.find((s) => s.slug === siteSlug)
  const [range, setRange] = useState<Range>('30d')
  const analytics = useAnalytics(site?.vercel_project_id ? site.slug : undefined, range)

  if (sites && !site) return <Navigate to="/" replace />
  if (!site) return <div className="splash" aria-busy="true" />
  if (!site.vercel_project_id) return <Navigate to={`/s/${site.slug}/posts`} replace />

  return (
    <Shell site={site} sites={sites ?? []}>
      <main className="page page--board">
        <AnalyticsView
          range={range}
          onRangeChange={setRange}
          report={analytics.report}
          loading={analytics.loading}
          error={analytics.error}
          onRetry={analytics.reload}
          updatedAt={analytics.updatedAt}
        />
      </main>
    </Shell>
  )
}
