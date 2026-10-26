import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'
import AuthCard from '../components/AuthCard'

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (session) return <Navigate to={from} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'That email and password don’t match. Check them, or reset your password.'
          : errorMessage(error),
      )
    }
  }

  return (
    <AuthCard title="Sign in" lead="Manage your website’s blog.">
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary button--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <Link className="form__link" to="/forgot-password">
          Forgotten your password?
        </Link>
      </form>
    </AuthCard>
  )
}
