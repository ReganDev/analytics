import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './lib/auth'
import Admin from './pages/Admin'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import SitePicker from './pages/SitePicker'
import SiteAnalytics from './pages/SiteAnalytics'
import SiteWorkspace from './pages/SiteWorkspace'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/" element={<RequireAuth><SitePicker /></RequireAuth>} />
      <Route path="/s/:siteSlug" element={<RequireAuth><SiteAnalytics /></RequireAuth>} />
      <Route path="/s/:siteSlug/posts" element={<RequireAuth><SiteWorkspace /></RequireAuth>} />
      <Route path="/s/:siteSlug/posts/:postId" element={<RequireAuth><SiteWorkspace /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
