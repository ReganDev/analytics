import { useCallback, useEffect, useRef, useState } from 'react'
import RichText from './RichText'
import { errorMessage, supabase } from '../lib/supabase'
import { formatDate, isValidSlug, slugify, statusLabel, statusOf, timeAgo } from '../lib/posts'
import type { DraftFields, Post } from '../lib/types'

const SAVE_DELAY = 700
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

const draftOf = (post: Post): DraftFields => ({
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  published_on: post.published_on,
  body: post.body,
})

function saveError(error: { code?: string; message?: string }) {
  if (error.code === '23505') return 'Another post already uses this web address. Change it to save.'
  return errorMessage(error)
}

/**
 * One post, edited like a Sanity document: every keystroke autosaves to the
 * draft, and nothing reaches the website until Publish copies the draft into
 * the published snapshot (which also triggers the site rebuild).
 */
export default function PostEditor({
  post,
  siteUrl,
  onChange,
  onDelete,
}: {
  post: Post
  siteUrl: string | null
  onChange: (post: Post) => void
  onDelete: () => void
}) {
  const [fields, setFields] = useState<DraftFields>(() => draftOf(post))
  const [live, setLive] = useState({ published: post.published, published_at: post.published_at })
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'publish' | 'unpublish' | 'delete' | null>(null)

  const latest = useRef(fields)
  const timer = useRef<number | undefined>(undefined)
  const dirty = useRef(false)

  const save = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return true
    dirty.current = false
    setSaveState('saving')
    const { data, error } = await supabase
      .from('posts')
      .update(latest.current)
      .eq('id', post.id)
      .select()
      .single()
    if (error) {
      dirty.current = true
      setSaveState('error')
      setMessage(saveError(error))
      return false
    }
    setSaveState(dirty.current ? 'pending' : 'saved')
    setMessage('')
    onChange(data as Post)
    return true
  }, [post.id, onChange])

  const update = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    setFields((current) => {
      const next = { ...current, [key]: value }
      latest.current = next
      return next
    })
    dirty.current = true
    setSaveState('pending')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(save, SAVE_DELAY)
  }

  // Save on the way out, and warn before closing the tab with unsaved typing.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      void save()
    }
  }, [save])

  const status = statusOf({ ...fields, published: live.published })

  async function publish() {
    setBusy('publish')
    setMessage('')
    setNotice('')
    if (!(await save())) return setBusy(null)
    const { data, error } = await supabase.rpc('publish_post', { post_id: post.id })
    setBusy(null)
    if (error) return setMessage(errorMessage(error))
    const row = data as Post
    setLive({ published: row.published, published_at: row.published_at })
    setNotice('Published. The website updates in about a minute.')
    onChange(row)
  }

  async function unpublish() {
    if (!window.confirm('Take this post off the website? It stays here as a draft.')) return
    setBusy('unpublish')
    const { data, error } = await supabase.rpc('unpublish_post', { post_id: post.id })
    setBusy(null)
    if (error) return setMessage(errorMessage(error))
    const row = data as Post
    setLive({ published: null, published_at: null })
    setNotice('Taken off the website. It disappears in about a minute.')
    onChange(row)
  }

  async function remove() {
    const warning = live.published
      ? 'Delete this post? It will also be removed from the website. This can’t be undone.'
      : 'Delete this draft? This can’t be undone.'
    if (!window.confirm(warning)) return
    setBusy('delete')
    window.clearTimeout(timer.current)
    dirty.current = false
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    setBusy(null)
    if (error) return setMessage(errorMessage(error))
    onDelete()
  }

  const slugProblem = fields.slug && !isValidSlug(fields.slug)
  const liveUrl = live.published && siteUrl ? `${siteUrl.replace(/\/$/, '')}/blog/${live.published.slug}` : null

  return (
    <section className="doc" aria-label="Edit post">
      <div className="doc__scroll">
        <div className="doc__form">
          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="input input--title"
              value={fields.title}
              placeholder="Untitled"
              maxLength={90}
              onChange={(e) => update('title', e.target.value)}
              onBlur={() => {
                if (!fields.slug && fields.title) update('slug', slugify(fields.title))
              }}
            />
          </label>

          <div className="field">
            <span className="field__label" id="slug-label">Web address</span>
            <div className="slug">
              <span className="slug__prefix">/blog/</span>
              <input
                className="input slug__input"
                aria-labelledby="slug-label"
                value={fields.slug}
                placeholder="your-post-title"
                onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              />
              <button
                type="button"
                className="button button--ghost button--small"
                disabled={!fields.title}
                onClick={() => update('slug', slugify(fields.title))}
              >
                Generate
              </button>
            </div>
            <span className={`field__hint ${slugProblem ? 'field__hint--error' : ''}`}>
              {slugProblem
                ? 'Use lowercase letters, numbers and single hyphens only.'
                : live.published
                  ? 'Changing this after publishing breaks links people have saved.'
                  : 'Generated from the title. Keep it short.'}
            </span>
          </div>

          <label className="field">
            <span className="field__label">Summary</span>
            <textarea
              className="input textarea"
              rows={3}
              value={fields.excerpt}
              onChange={(e) => update('excerpt', e.target.value)}
            />
            <span className={`field__hint ${fields.excerpt.length > 200 ? 'field__hint--error' : ''}`}>
              Shown under the title in the blog list and in Google results · {fields.excerpt.length}/200
            </span>
          </label>

          <label className="field field--date">
            <span className="field__label">Date</span>
            <input
              className="input"
              type="date"
              value={fields.published_on}
              onChange={(e) => update('published_on', e.target.value)}
            />
            <span className="field__hint">Shown as “Posted … ago”. A future date keeps the post hidden until then.</span>
          </label>

          <div className="field">
            <span className="field__label">Article</span>
            <RichText docKey={post.id} value={fields.body} onChange={(body) => update('body', body)} />
          </div>
        </div>
      </div>

      <footer className="docbar">
        <div className="docbar__status">
          <span className={`badge badge--${status}`}>{statusLabel[status]}</span>
          <span className="docbar__meta">
            {saveState === 'saving' || saveState === 'pending'
              ? 'Saving…'
              : saveState === 'error'
                ? 'Not saved'
                : live.published_at
                  ? `Published ${timeAgo(live.published_at)} · dated ${formatDate(fields.published_on)}`
                  : 'Saved as draft'}
          </span>
          {liveUrl && status !== 'draft' && (
            <a className="docbar__link" href={liveUrl} target="_blank" rel="noreferrer">
              View on website ↗
            </a>
          )}
        </div>
        {message ? (
          <p className="docbar__error" role="alert">
            {message}
          </p>
        ) : (
          notice && (
            <p className="docbar__notice" role="status">
              {notice}
            </p>
          )
        )}
        <div className="docbar__actions">
          <button className="button button--ghost button--danger button--small" onClick={remove} disabled={busy !== null}>
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
          {live.published && (
            <button className="button button--ghost button--small" onClick={unpublish} disabled={busy !== null}>
              {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
            </button>
          )}
          <button
            className="button button--primary"
            onClick={publish}
            disabled={busy !== null || status === 'published'}
          >
            {busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Published' : 'Publish'}
          </button>
        </div>
      </footer>
    </section>
  )
}
