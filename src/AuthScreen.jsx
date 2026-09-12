import { useState } from 'react'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'

function getFriendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email or password does not match an approved account.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'The sign-in service is unreachable. Check your connection and try again.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}

export default function AuthScreen({ auth, mode = 'sign-in', user }) {
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const isWorking = status.type === 'working'

  async function handleSignIn(event) {
    event.preventDefault()
    setStatus({ type: 'working', message: 'Opening the personal ledger…' })

    try {
      await setPersistence(
        auth,
        keepSignedIn ? browserLocalPersistence : browserSessionPersistence
      )
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (error) {
      setStatus({ type: 'error', message: getFriendlyAuthError(error) })
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Enter your email address first.' })
      return
    }

    setStatus({ type: 'working', message: 'Sending reset email…' })

    try {
      await sendPasswordResetEmail(auth, email.trim())
      setStatus({
        type: 'success',
        message: 'Password reset email sent. Check your inbox.',
      })
    } catch (error) {
      setStatus({ type: 'error', message: getFriendlyAuthError(error) })
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">
          <span className="auth-brand-mark">
            <img src={`${import.meta.env.BASE_URL}icons/pig-comic-192.png`} alt="" />
          </span>
          <span className="auth-brand-rule" />
        </div>

        {mode === 'loading' ? (
          <div className="auth-message" aria-live="polite">
            <p className="auth-kicker">Personal Expense Tracker</p>
            <h1 id="auth-title">Checking your session…</h1>
            <span className="auth-loading-bar" aria-hidden="true" />
          </div>
        ) : null}

        {mode === 'configuration' ? (
          <div className="auth-message">
            <p className="auth-kicker">Setup required</p>
            <h1 id="auth-title">Firebase needs one more step.</h1>
            <p>
              Add the Firebase web configuration and your approved account UID and database URL to
              your environment before connecting the personal ledger.
            </p>
          </div>
        ) : null}

        {mode === 'unauthorized' ? (
          <div className="auth-message">
            <p className="auth-kicker">Account not approved</p>
            <h1 id="auth-title">This ledger is private.</h1>
            <p>
              <strong>{user?.email}</strong> signed in successfully, but this account
              is not on the personal account allowlist.
            </p>
            <button className="primary-button auth-submit" type="button" onClick={() => signOut(auth)}>
              Sign in with another account
            </button>
          </div>
        ) : null}

        {mode === 'sign-in' ? (
          <>
            <header className="auth-heading">
              <p className="auth-kicker">Personal Expense Tracker</p>
              <h1 id="auth-title">Welcome home.</h1>
              <p>Sign in to open your personal expenses.</p>
            </header>

            <form className="auth-form" onSubmit={handleSignIn}>
              <label htmlFor="auth-email">
                <span>Email</span>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label htmlFor="auth-password">
                <span>Password</span>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(event) => setKeepSignedIn(event.target.checked)}
                />
                <span className="auth-remember-copy">
                  <strong>Keep me signed in on this device</strong>
                </span>
              </label>

              <button className="primary-button auth-submit" type="submit" disabled={isWorking}>
                {isWorking ? 'Signing in…' : 'Sign in'}
              </button>

              <button
                className="auth-reset-button"
                type="button"
                onClick={handlePasswordReset}
                disabled={isWorking}
              >
                Forgot password?
              </button>

              {status.message ? (
                <p className={`auth-status auth-status-${status.type}`} aria-live="polite">
                  {status.message}
                </p>
              ) : null}
            </form>
          </>
        ) : null}
      </section>

      <p className="auth-footnote">Your expenses · Kept privately</p>
    </main>
  )
}

