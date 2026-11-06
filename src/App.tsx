import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RequireAuth } from './lib/auth'
import { BLOG_ENABLED } from './lib/features'
import Admin from './pages/Admin'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import SitePicker from './pages/SitePicker'
import SiteAnalytics from './pages/SiteAnalytics'
import SiteWorkspace from './pages/SiteWorkspace'

/** While the blog is switched off, old or bookmarked /posts links land on the site's analytics. */
function BlogComingSoon() {
  const { siteSlug } = useParams<{ siteSlug: string }>()
  return <Navigate to={`/s/${siteSlug}`} replace />
}

export default function App() {
  const posts = BLOG_ENABLED ? (
    <RequireAuth>
      <SiteWorkspace />
    </RequireAuth>
  ) : (
    <BlogComingSoon />
  )

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/" element={<RequireAuth><SitePicker /></RequireAuth>} />
      <Route path="/s/:siteSlug" element={<RequireAuth><SiteAnalytics /></RequireAuth>} />
      <Route path="/s/:siteSlug/posts" element={posts} />
      <Route path="/s/:siteSlug/posts/:postId" element={posts} />
      <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
