import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import PostEditor from '../components/PostEditor'
import Shell from '../components/Shell'
import { formatDate, statusLabel, statusOf } from '../lib/posts'
import { errorMessage, supabase } from '../lib/supabase'
import type { Post } from '../lib/types'
import { useSites } from '../lib/useSites'

const sortPosts = (posts: Post[]) =>
  [...posts].sort(
    (a, b) => b.published_on.localeCompare(a.published_on) || b.updated_at.localeCompare(a.updated_at),
  )

/** Sanity-style two panes: the site's posts on the left, the open post on the right. */
export default function SiteWorkspace() {
  const { siteSlug, postId } = useParams<{ siteSlug: string; postId?: string }>()
  const navigate = useNavigate()
  const { sites } = useSites()
  const site = sites?.find((s) => s.slug === siteSlug)

  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!site) return
    setPosts(null)
    supabase
      .from('posts')
      .select('*')
      .eq('site_id', site.id)
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error))
        setPosts(sortPosts((data as Post[]) ?? []))
      })
  }, [site])

  const replacePost = useCallback(
    (next: Post) => setPosts((current) => sortPosts((current ?? []).map((p) => (p.id === next.id ? next : p)))),
    [],
  )

  if (sites && !site) return <Navigate to="/" replace />
  if (!site || !posts) return <div className="splash" aria-busy="true" />

  const open = posts.find((p) => p.id === postId)

  async function createPost() {
    setCreating(true)
    const { data, error } = await supabase.from('posts').insert({ site_id: site!.id }).select().single()
    setCreating(false)
    if (error) return setError(errorMessage(error))
    setPosts((current) => sortPosts([data as Post, ...(current ?? [])]))
    navigate(`/s/${site!.slug}/p/${(data as Post).id}`)
  }

  return (
    <Shell site={site} sites={sites ?? []}>
      <div className={`workspace ${open ? 'workspace--open' : ''}`}>
        <nav className="pane pane--list" aria-label="Blog posts">
          <div className="pane__head">
            <h1 className="pane__title">Blog posts</h1>
            <button className="button button--primary button--small" onClick={createPost} disabled={creating}>
              {creating ? 'Creating…' : '+ New post'}
            </button>
          </div>
          {error && <p className="form__error pane__error">{error}</p>}
          {posts.length === 0 ? (
            <div className="empty empty--pane">
              <p className="empty__title">No posts yet</p>
              <p className="empty__text">Click “New post” to write your first article.</p>
            </div>
          ) : (
            <ul className="postlist">
              {posts.map((p) => {
                const status = statusOf(p)
                return (
                  <li key={p.id}>
                    <button
                      className="postlist__item"
                      aria-current={p.id === postId ? 'true' : undefined}
                      onClick={() => navigate(`/s/${site.slug}/p/${p.id}`)}
                    >
                      <span className="postlist__title">{p.title || 'Untitled'}</span>
                      <span className="postlist__meta">
                        <span className={`dot dot--${status}`} aria-hidden="true" />
                        {statusLabel[status]} · {formatDate(p.published_on)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        {open ? (
          <PostEditor
            key={open.id}
            post={open}
            siteUrl={site.site_url}
            onChange={replacePost}
            onDelete={() => {
              setPosts((current) => (current ?? []).filter((p) => p.id !== open.id))
              navigate(`/s/${site.slug}`)
            }}
          />
        ) : (
          <section className="doc doc--empty">
            <div className="empty">
              <p className="empty__title">Choose a post to edit</p>
              <p className="empty__text">Or start a new one. Changes save automatically; nothing appears on your website until you press Publish.</p>
            </div>
          </section>
        )}
      </div>
      {open && (
        <button className="backlink" onClick={() => navigate(`/s/${site.slug}`)}>
          ← All posts
        </button>
      )}
    </Shell>
  )
}
