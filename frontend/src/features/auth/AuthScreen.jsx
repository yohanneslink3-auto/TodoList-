import { useState } from 'react'
import { useLoginMutation, useRegisterMutation } from '../../app/services/api'

function getError(error) {
  return error?.data?.error || 'Something went wrong. Please try again.'
}

function PasswordInput({ autoComplete, id, onChange, value, visible, onToggle, ...inputProps }) {
  return (
    <span className="password-input">
      <input
        {...inputProps}
        autoComplete={autoComplete}
        id={id}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        value={value}
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="password-visibility"
        onClick={onToggle}
        type="button"
      >
        {visible ? (
          <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.7 10.7 0 0112 5c5.4 0 9 7 9 7a15.7 15.7 0 01-3.1 3.8M6.2 6.2C3.9 7.8 3 12 3 12s3.6 7 9 7a9.9 9.9 0 004.1-.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
        ) : (
          <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17">
            <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        )}
      </button>
    </span>
  )
}

export function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [login, loginState] = useLoginMutation()
  const [register, registerState] = useRegisterMutation()
  const pending = loginState.isLoading || registerState.isLoading
  const error = loginState.error || registerState.error
  const passwordsMatch = password === confirmPassword

  async function submit(event) {
    event.preventDefault()
    if (mode === 'register' && !passwordsMatch) return
    try {
      if (mode === 'register') await register({ name, email, password, confirmPassword }).unwrap()
      else await login({ email, password }).unwrap()
    } catch {
      return
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="/">
          <span className="brand-mark">✓</span>
          <span>task<span className="brand-light">flow</span></span>
        </a>
        <p className="eyebrow">A CALMER WAY TO GET THINGS DONE</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Make it yours.'}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create your account and make space for what matters.'}
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Account options">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Your name
              <input autoComplete="name" maxLength="60" minLength="2" onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" required value={name} />
            </label>
          )}
          <label>
            Email address
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          <label>
            Password
            <PasswordInput
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength="8"
              onChange={(event) => setPassword(event.target.value)}
              onToggle={() => setPasswordVisible(!passwordVisible)}
              placeholder="At least 8 characters"
              required
              value={password}
              visible={passwordVisible}
            />
          </label>
          {mode === 'register' && (
            <label>
              Confirm password
              <PasswordInput
                autoComplete="new-password"
                aria-describedby={confirmPassword && !passwordsMatch ? 'confirm-password-error' : undefined}
                aria-invalid={Boolean(confirmPassword && !passwordsMatch)}
                minLength="8"
                onChange={(event) => setConfirmPassword(event.target.value)}
                onToggle={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                placeholder="Enter your password again"
                required
                value={confirmPassword}
                visible={confirmPasswordVisible}
              />
              {confirmPassword && !passwordsMatch && (
                <span className="form-error" id="confirm-password-error" role="alert">Passwords do not match.</span>
              )}
            </label>
          )}
          {error && <p className="form-error" role="alert">{getError(error)}</p>}
          <button className="primary-button auth-submit" disabled={pending} type="submit">
            {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            {!pending && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="auth-footnote">Your tasks are private and only visible to you.</p>
      </section>
      <aside className="auth-aside">
        <div className="aside-orb orb-one" />
        <div className="aside-orb orb-two" />
        <p className="eyebrow">FOCUS ON THE NEXT THING</p>
        <h2>Small steps.<br />Clear mind.<br /><span>Good things follow.</span></h2>
        <p>Keep your work, plans, and everyday life in one thoughtful space.</p>
        <div className="aside-checklist">
          <span>✓</span><div><strong>Today, with intention</strong><small>Make progress at your own pace.</small></div>
        </div>
      </aside>
    </main>
  )
}
