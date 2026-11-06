import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import AnalyticsView from '../components/analytics/AnalyticsView'
import Shell from '../components/Shell'
import type { Range } from '../lib/analytics'
import { BLOG_ENABLED } from '../lib/features'
import { useAnalytics } from '../lib/useAnalytics'
import { useSites } from '../lib/useSites'

/**
 * A site's landing page: its analytics. With none linked it goes straight to the
 * blog, or, while the blog is switched off, says analytics aren't connected yet
 * (redirecting would bounce between the two pages forever).
 */
export default function SiteAnalytics() {
  const { siteSlug } = useParams<{ siteSlug: string }>()
  const { sites } = useSites()
  const site = sites?.find((s) => s.slug === siteSlug)
  const [range, setRange] = useState<Range>('30d')
  const analytics = useAnalytics(site?.vercel_project_id ? site.slug : undefined, range)

  if (sites && !site) return <Navigate to="/" replace />
  if (!site) return <div className="splash" aria-busy="true" />
  if (!site.vercel_project_id) {
    if (BLOG_ENABLED) return <Navigate to={`/s/${site.slug}/posts`} replace />
    return (
      <Shell site={site} sites={sites ?? []}>
        <main className="page">
          <div className="empty empty--pane">
            <p className="empty__title">Analytics aren’t connected yet</p>
            <p className="empty__text">
              Your website’s visitor numbers will appear here once they’re set up. Please contact Regan.
            </p>
          </div>
        </main>
      </Shell>
    )
  }

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
