import { Link, Navigate } from 'react-router-dom'
import Shell from '../components/Shell'
import { useAuth } from '../lib/auth'
import { useSites } from '../lib/useSites'

/** Home: straight into the site if there is only one, otherwise a list. */
export default function SitePicker() {
  const { sites, error } = useSites()
  const { isAdmin } = useAuth()

  if (!sites) return <div className="splash" aria-busy="true" />
  if (sites.length === 1 && !isAdmin) return <Navigate to={`/s/${sites[0].slug}`} replace />

  return (
    <Shell>
      <main className="page">
        <h1 className="page__title">Your websites</h1>
        {error && <p className="form__error">{error}</p>}
        {sites.length === 0 ? (
          <div className="empty">
            <p className="empty__title">No websites yet</p>
            <p className="empty__text">
              {isAdmin
                ? 'Create the first site in Admin.'
                : 'Your account isn’t linked to a website yet. Please contact Regan.'}
            </p>
          </div>
        ) : (
          <ul className="sitelist">
            {sites.map((site) => (
              <li key={site.id}>
                <Link className="sitelist__item" to={`/s/${site.slug}`}>
                  <span className="sitelist__name">{site.name}</span>
                  <span className="sitelist__meta">{site.site_url ?? site.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </Shell>
  )
}
