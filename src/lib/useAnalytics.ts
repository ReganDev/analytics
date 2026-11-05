import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalyticsReport, Range } from './analytics'
import { supabase } from './supabase'

interface State {
  report: AnalyticsReport | null
  loading: boolean
  error: string
  updatedAt: Date | null
}

/**
 * A site's report from /api/analytics, sent with the signed-in user's access
 * token so the function can check their membership. Switching range keeps the
 * last report on screen (dimmed) until the new one lands.
 */
export function useAnalytics(siteSlug: string | undefined, range: Range) {
  const [state, setState] = useState<State>({ report: null, loading: false, error: '', updatedAt: null })
  // Only the latest request may update state, so a slow 30-day response can't
  // overwrite a 7-day one requested after it.
  const latest = useRef(0)

  const load = useCallback(async () => {
    if (!siteSlug) return
    const id = ++latest.current
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(`/api/analytics?site=${encodeURIComponent(siteSlug)}&range=${range}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
      if (id === latest.current) setState({ report: body as AnalyticsReport, loading: false, error: '', updatedAt: new Date() })
    } catch (error) {
      if (id === latest.current) {
        setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : String(error) }))
      }
    }
  }, [siteSlug, range])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}
