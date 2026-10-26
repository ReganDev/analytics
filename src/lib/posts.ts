import type { DraftFields, Post, PostStatus } from './types'

/** "Runner's knee: what it is" -> "runners-knee-what-it-is" */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

export const isValidSlug = (slug: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)

/** JSON with sorted keys, so Postgres jsonb key order never reads as a change. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function statusOf(post: Pick<Post, 'published'> & DraftFields): PostStatus {
  const live = post.published
  if (!live) return 'draft'
  const same =
    live.title === post.title &&
    live.slug === post.slug &&
    live.excerpt === post.excerpt &&
    live.publishedAt === post.published_on &&
    stable(live.body) === stable(post.body)
  return same ? 'published' : 'changed'
}

export const statusLabel: Record<PostStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  changed: 'Unpublished changes',
}

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

export function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 45) return 'just now'
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'],
  ]
  let value = seconds
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return relative.format(-Math.round(value), unit)
    value /= size
  }
  return relative.format(-Math.round(value), 'year')
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00`),
  )
