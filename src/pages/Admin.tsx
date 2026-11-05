import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Shell from '../components/Shell'
import { slugify } from '../lib/posts'
import { errorMessage, supabase } from '../lib/supabase'
import { SITE_COLUMNS, type Site } from '../lib/types'

interface Member {
  user_id: string
  email: string
  added_at: string
}

interface VercelProject {
  id: string
  name: string
  url: string | null
}

const host = (url: string) => url.replace(/^https?:\/\//, '')

/** The team's Vercel projects, from the admin-only api/vercel-projects function. */
function useVercelProjects() {
  const [projects, setProjects] = useState<VercelProject[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/vercel-projects', {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error ?? `Couldn’t load Vercel projects (${res.status}).`)
        setProjects([])
      } else {
        setProjects(body as VercelProject[])
      }
    })()
  }, [])

  return { projects, error }
}

function SiteAdmin({
  site,
  onChange,
  projects,
  projectsError,
}: {
  site: Site
  onChange: (site: Site) => void
  projects: VercelProject[] | null
  projectsError: string
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [hasHook, setHasHook] = useState<boolean | null>(null)
  const [hook, setHook] = useState('')
  const [email, setEmail] = useState('')
  const [siteUrl, setSiteUrl] = useState(site.site_url ?? '')
  const [projectId, setProjectId] = useState(site.vercel_project_id ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const [m, h] = await Promise.all([
      supabase.rpc('admin_site_members', { target_site: site.id }),
      supabase.rpc('admin_has_deploy_hook', { target_site: site.id }),
    ])
    setMembers((m.data as Member[]) ?? [])
    setHasHook(h.data === true)
  }

  useEffect(() => {
    void load()
  }, [site.id])

  const done = (text: string) => {
    setError('')
    setMessage(text)
  }
  const fail = (e: unknown) => {
    setMessage('')
    setError(errorMessage(e))
  }

  async function saveHook(event: FormEvent) {
    event.preventDefault()
    const { error } = await supabase.rpc('admin_set_deploy_hook', { target_site: site.id, hook_url: hook })
    if (error) return fail(error)
    setHook('')
    await load()
    done(hook ? 'Deploy hook saved. Publishing now rebuilds this site.' : 'Deploy hook removed.')
  }

  async function saveUrl(event: FormEvent) {
    event.preventDefault()
    const { data, error } = await supabase
      .from('sites')
      .update({ site_url: siteUrl.trim() || null })
      .eq('id', site.id)
      .select(SITE_COLUMNS)
      .single()
    if (error) return fail(error)
    onChange(data as Site)
    done('Website address saved.')
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault()
    const { data, error } = await supabase
      .from('sites')
      .update({ vercel_project_id: projectId || null })
      .eq('id', site.id)
      .select(SITE_COLUMNS)
      .single()
    if (error) return fail(error)
    onChange(data as Site)
    done(projectId ? 'Analytics connected. Members now see the Analytics tab.' : 'Analytics disconnected.')
  }

  async function invite(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    // Emails a one-time sign-in link and creates the account if it doesn't
    // exist yet. The link lands on /set-password so they choose a password.
    const sent = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/set-password` },
    })
    if (sent.error) return fail(sent.error)
    const added = await supabase.rpc('admin_add_member', { target_site: site.id, member_email: address })
    if (added.error) return fail(added.error)
    setEmail('')
    await load()
    done(`Invite sent to ${address}. They’ll get a link to set their password.`)
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.email} from ${site.name}? Their account stays, but they lose access to this site.`)) return
    const { error } = await supabase
      .from('site_members')
      .delete()
      .eq('site_id', site.id)
      .eq('user_id', member.user_id)
    if (error) return fail(error)
    await load()
    done(`${member.email} removed.`)
  }

  return (
    <article className="card">
      <header className="card__head">
        <div>
          <h2 className="card__title">{site.name}</h2>
          <p className="card__meta">
            Build key: <code>{site.slug}</code>
          </p>
        </div>
        <span className="card__actions">
          {site.vercel_project_id && (
            <Link className="button button--ghost button--small" to={`/s/${site.slug}`}>
              Open analytics
            </Link>
          )}
          <Link className="button button--ghost button--small" to={`/s/${site.slug}/posts`}>
            Open posts
          </Link>
        </span>
      </header>

      <form className="row" onSubmit={saveUrl}>
        <label className="field field--grow">
          <span className="field__label">Website address</span>
          <input className="input" type="url" placeholder="https://example.co.uk" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} />
        </label>
        <button className="button button--ghost">Save</button>
      </form>

      <form className="row" onSubmit={saveProject}>
        <label className="field field--grow">
          <span className="field__label">
            Vercel project{' '}
            <span className={`pill ${site.vercel_project_id ? 'pill--ok' : 'pill--warn'}`}>
              {site.vercel_project_id ? 'Connected' : 'Not connected'}
            </span>
          </span>
          <select
            className="input"
            value={projectId}
            disabled={projects === null}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{projects === null ? 'Loading projects…' : 'Not connected'}</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.url ? ` — ${host(p.url)}` : ''}
              </option>
            ))}
            {projectId && projects && !projects.some((p) => p.id === projectId) && (
              <option value={projectId}>{projectId}</option>
            )}
          </select>
          <span className={`field__hint ${projectsError ? 'field__hint--error' : ''}`}>
            {projectsError ||
              'Members of this site see this project’s Web Analytics. Turn Web Analytics on for the project in Vercel first.'}
          </span>
        </label>
        <button className="button button--ghost" disabled={projectId === (site.vercel_project_id ?? '')}>
          Save
        </button>
      </form>

      <form className="row" onSubmit={saveHook}>
        <label className="field field--grow">
          <span className="field__label">
            Vercel deploy hook{' '}
            <span className={`pill ${hasHook ? 'pill--ok' : 'pill--warn'}`}>{hasHook ? 'Set' : 'Not set'}</span>
          </span>
          <input
            className="input"
            type="url"
            placeholder={hasHook ? 'Paste a new URL to replace it, or leave empty and save to remove' : 'https://api.vercel.com/v1/integrations/deploy/…'}
            value={hook}
            onChange={(e) => setHook(e.target.value)}
          />
          <span className="field__hint">Kept secret: it’s stored server-side and never shown again.</span>
        </label>
        <button className="button button--ghost">Save</button>
      </form>

      <div className="field">
        <span className="field__label">People with access</span>
        {members.length === 0 ? (
          <p className="field__hint">Nobody yet.</p>
        ) : (
          <ul className="members">
            {members.map((m) => (
              <li key={m.user_id} className="members__item">
                <span>{m.email}</span>
                <button className="button button--ghost button--danger button--small" onClick={() => removeMember(m)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="row" onSubmit={invite}>
        <label className="field field--grow">
          <span className="field__label">Invite someone</span>
          <input className="input" type="email" required placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="button button--primary">Send invite</button>
      </form>

      {error && <p className="form__error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
    </article>
  )
}

export default function Admin() {
  const [sites, setSites] = useState<Site[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const vercel = useVercelProjects()

  useEffect(() => {
    supabase
      .from('sites')
      .select(SITE_COLUMNS)
      .order('name')
      .then(({ data }) => setSites((data as Site[]) ?? []))
  }, [])

  async function createSite(event: FormEvent) {
    event.preventDefault()
    const { data, error } = await supabase
      .from('sites')
      .insert({ name: name.trim(), slug: slug || slugify(name) })
      .select(SITE_COLUMNS)
      .single()
    if (error) return setError(error.code === '23505' ? 'That build key is already taken.' : errorMessage(error))
    setSites((current) => [...current, data as Site].sort((a, b) => a.name.localeCompare(b.name)))
    setName('')
    setSlug('')
    setError('')
  }

  return (
    <Shell>
      <main className="page">
        <h1 className="page__title">Admin</h1>
        <p className="page__lead">Client sites, who can see them, their Vercel analytics, and the hook that rebuilds each one on publish.</p>

        <form className="card row" onSubmit={createSite}>
          <label className="field field--grow">
            <span className="field__label">New site name</span>
            <input className="input" required placeholder="Orpington Osteopaths" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Build key</span>
            <input className="input" placeholder={slugify(name) || 'orpington-osteopaths'} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
          </label>
          <button className="button button--primary">Create site</button>
          {error && <p className="form__error" role="alert">{error}</p>}
        </form>

        {sites.map((site) => (
          <SiteAdmin
            key={site.id}
            site={site}
            projects={vercel.projects}
            projectsError={vercel.error}
            onChange={(next) => setSites((current) => current.map((s) => (s.id === next.id ? next : s)))}
          />
        ))}
      </main>
    </Shell>
  )
}
