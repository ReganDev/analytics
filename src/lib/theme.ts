import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'portal-theme'

/**
 * The theme on <html data-theme>. An inline script in each HTML entry sets it
 * before first paint (saved choice, else the device setting), so there is no
 * flash of the wrong theme; this reads it back and lets the toggle change it.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // Private mode or blocked storage: the choice lasts for this visit only.
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
