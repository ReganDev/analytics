import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { SITE_COLUMNS, type Site } from './types'

/** Sites the signed-in user can open: their own, or all of them for admins. */
export function useSites() {
  const [sites, setSites] = useState<Site[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('sites')
      .select(SITE_COLUMNS)
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        setSites(data ?? [])
      })
  }, [])

  return { sites, error }
}
