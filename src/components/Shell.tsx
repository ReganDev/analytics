import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Site } from '../lib/types'
import Brand from './Brand'
import SiteTabs from './SiteTabs'
import ThemeToggle from './ThemeToggle'

/** Top bar shared by every signed-in screen. */
export default function Shell({
  site,
  sites = [],
  children,
}: {
  site?: Site
  sites?: Site[]
  children: ReactNode
}) {
  const { session, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand brand--bar">
          <Brand />
        </Link>

        {site && (
          <>
            <span className="topbar__divider" aria-hidden="true">/</span>
            {sites.length > 1 ? (
              <select
                className="topbar__site"
                value={site.slug}
                aria-label="Switch site"
                onChange={(e) => navigate(`/s/${e.target.value}`)}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="topbar__site topbar__site--static">{site.name}</span>
            )}
            <SiteTabs siteSlug={site.slug} analytics={!!site.vercel_project_id} inline />
          </>
        )}

        <span className="topbar__spacer" />
        {site?.site_url && (
          <a className="topbar__visit" href={site.site_url} target="_blank" rel="noreferrer">
            View website ↗
          </a>
        )}
        {isAdmin && (
          <Link className="topbar__link" to="/admin">
            Admin
          </Link>
        )}
        <ThemeToggle />
        <span className="topbar__user" title={session?.user.email}>
          {session?.user.email}
        </span>
        <button className="button button--ghost button--small" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      {children}
    </div>
  )
}
