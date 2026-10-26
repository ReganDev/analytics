import type { JSONContent } from '@tiptap/react'

export interface Site {
  id: string
  slug: string
  name: string
  site_url: string | null
}

/** The frozen copy a client site builds from. */
export interface PublishedSnapshot {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  body: JSONContent
}

export interface Post {
  id: string
  site_id: string
  title: string
  slug: string
  excerpt: string
  published_on: string
  body: JSONContent
  published: PublishedSnapshot | null
  published_at: string | null
  updated_at: string
}

/** The fields a member edits; everything else is managed by the database. */
export type DraftFields = Pick<Post, 'title' | 'slug' | 'excerpt' | 'published_on' | 'body'>

export type PostStatus = 'draft' | 'published' | 'changed'
