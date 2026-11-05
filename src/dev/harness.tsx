import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/chivo'
import '@fontsource-variable/chivo-mono'
import '../index.css'
import AnalyticsHarness from './AnalyticsHarness'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsHarness />
  </StrictMode>,
)
