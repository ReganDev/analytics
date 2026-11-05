import { NavLink } from 'react-router-dom'

/**
 * Analytics | Blog posts. Analytics only shows once a Vercel project is linked.
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
      <NavLink className="tabs__link" to={`/s/${siteSlug}/posts`}>
        Blog posts
      </NavLink>
    </nav>
  )
}
