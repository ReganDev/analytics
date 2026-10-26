import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, supabase } from '../lib/supabase'
import AuthCard from '../components/AuthCard'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setSent(true)
  }

  return (
    <AuthCard title="Reset your password" lead="We’ll email you a link to choose a new one.">
      {sent ? (
        <p className="notice">
          If <strong>{email}</strong> has an account, a reset link is on its way. It can take a
          minute; check your spam folder too.
        </p>
      ) : (
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
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary button--block" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <Link className="form__link" to="/login">
        Back to sign in
      </Link>
    </AuthCard>
  )
}
