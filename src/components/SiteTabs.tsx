import { NavLink } from 'react-router-dom'
import { BLOG_ENABLED } from '../lib/features'

/**
 * Analytics | Blog posts. Analytics only shows once a Vercel project is linked.
 * While the blog is switched off (lib/features.ts) its tab is greyed out, with a
 * "Soon" badge and a tip on hover, focus or tap.
 * `inline` sits it inside the top bar, which the one-page board needs for height.
 */
export default function SiteTabs({
  siteSlug,
  analytics,
  inline = false,
}: {
  siteSlug: string
  analytics: boolean
  inline?: boolean
}) {
  return (
    <nav className={`tabs ${inline ? 'tabs--inline' : ''}`} aria-label="Site sections">
      {analytics && (
        <NavLink end className="tabs__link" to={`/s/${siteSlug}`}>
          Analytics
        </NavLink>
      )}
      {BLOG_ENABLED ? (
        <NavLink className="tabs__link" to={`/s/${siteSlug}/posts`}>
          Blog posts
        </NavLink>
      ) : (
        <span
          className="tabs__link tabs__link--soon"
          role="link"
          aria-disabled="true"
          aria-describedby="blog-soon-tip"
          tabIndex={0}
        >
          Blog posts
          <span className="tabs__soon" aria-hidden="true">
            Soon
          </span>
          <span className="tabs__tip" role="tooltip" id="blog-soon-tip">
            Blog editing is coming soon.
          </span>
        </span>
      )}
    </nav>
  )
}
