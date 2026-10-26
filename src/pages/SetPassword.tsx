import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'
import AuthCard from '../components/AuthCard'

/**
 * Landing page for invite and password-reset emails. Supabase signs the user
 * in from the link itself, so all that is left is choosing a password.
 */
export default function SetPassword() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session === undefined) return <div className="splash" aria-busy="true" />
  if (!session) {
    return (
      <AuthCard title="This link has expired" lead="Links in invite and reset emails only work once, for a limited time.">
        <Link className="button button--primary button--block" to="/forgot-password">
          Send a new link
        </Link>
      </AuthCard>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else navigate('/', { replace: true })
  }

  return (
    <AuthCard title="Choose a password" lead={`For ${session.user.email}`}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field__hint">At least 8 characters.</span>
        </label>
        <label className="field">
          <span className="field__label">Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary button--block" disabled={busy}>
          {busy ? 'Saving…' : 'Save password and continue'}
        </button>
      </form>
    </AuthCard>
  )
}
