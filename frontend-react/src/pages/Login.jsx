import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../api/client'

const FEATURES = [
  'Real-time stock tracking & alerts',
  'Purchase order management',
  'Supplier catalog management',
  'Profit & loss analytics',
  'Role-based access control',
]

// Simple inline SVG eye icons — no extra dependency needed
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function Login() {
  const [tab, setTab]                   = useState('login')
  const [loginError, setLoginError]     = useState(null)
  const [showLoginPwd, setShowLoginPwd] = useState(false)
  const [showRegPwd, setShowRegPwd]     = useState(false)
  const [liveStats, setLiveStats]       = useState(null)

  const navigate = useNavigate()
  const { login, register: registerUser, token } = useAuth()
  const { toast } = useToast()

  useEffect(() => { if (token) navigate('/dashboard') }, [token, navigate])

  // Fetch live counts for the branding panel — no auth needed
  useEffect(() => {
    api.get('/auth/stats').then(r => setLiveStats(r.data)).catch(() => {})
  }, [])

  const {
    register: regL, handleSubmit: handleL,
    formState: { errors: errL, isSubmitting: loadingL },
  } = useForm()

  const {
    register: regR, handleSubmit: handleR,
    formState: { errors: errR, isSubmitting: loadingR },
    reset: resetR,
  } = useForm({ defaultValues: { role: 'staff' } })

  async function onLogin({ email, password }) {
    setLoginError(null)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setLoginError(detail || 'Invalid email or password. Please try again.')
    }
  }

  async function onRegister(data) {
    try {
      await registerUser({ full_name: data.full_name, email: data.email, password: data.password, role: data.role })
      toast('Account created! Please sign in.', 'success')
      resetR(); setTab('login')
    } catch (err) {
      const detail = err.response?.data?.detail
      toast(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Registration failed', 'error')
    }
  }

  return (
    <div className="auth-page">
      {/* ── Left branding panel ── */}
      <div className="auth-left">
        <div className="auth-left-content">
          <span className="auth-logo-mark">📦</span>
          <h1>InvenTrack</h1>
          <p className="tagline">Smart Inventory Management Platform</p>
          <ul className="auth-features">
            {FEATURES.map(f => <li key={f}>{f}</li>)}
          </ul>
          {/* Live stats fetched from the API */}
          <div className="auth-stats">
            <div>
              <span>{liveStats ? liveStats.total_products : '—'}</span>
              <p>Products</p>
            </div>
            <div>
              <span>{liveStats ? liveStats.total_suppliers : '—'}</span>
              <p>Suppliers</p>
            </div>
            <div><span>3</span><p>Roles</p></div>
          </div>
          {liveStats && (
            <p style={{ color: 'rgba(199,210,254,0.6)', fontSize: '0.72rem', marginTop: 12 }}>
              ● Live data
            </p>
          )}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="form-header">
            <h2>{tab === 'login' ? 'Welcome back' : 'Create account'}</h2>
            <p>{tab === 'login' ? 'Sign in to continue to InvenTrack' : 'Start managing your inventory today'}</p>
          </div>

          <div className="auth-tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setLoginError(null) }}>Sign In</button>
            <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setLoginError(null) }}>Register</button>
          </div>

          {tab === 'login' && (
            <form onSubmit={handleL(onLogin)} noValidate>
              {loginError && (
                <div className="form-error-box">
                  <span>⚠️</span> {loginError}
                </div>
              )}
              <div className="form-group">
                <label>Email address</label>
                <input className={`form-control${errL.email ? ' input-error' : ''}`}
                  type="email" placeholder="you@example.com" autoComplete="email"
                  {...regL('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                  })} />
                {errL.email && <span className="field-error">{errL.email.message}</span>}
              </div>
              <div className="form-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input className={`form-control${errL.password ? ' input-error' : ''}`}
                    type={showLoginPwd ? 'text' : 'password'}
                    placeholder="••••••••" autoComplete="current-password"
                    {...regL('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' },
                    })} />
                  <button type="button" className="password-toggle" tabIndex={-1}
                    onClick={() => setShowLoginPwd(v => !v)}
                    aria-label={showLoginPwd ? 'Hide password' : 'Show password'}>
                    {showLoginPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errL.password && <span className="field-error">{errL.password.message}</span>}
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={loadingL}>
                {loadingL ? <span className="spinner" /> : 'Sign In →'}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleR(onRegister)} noValidate>
              <div className="form-group">
                <label>Full Name</label>
                <input className={`form-control${errR.full_name ? ' input-error' : ''}`}
                  placeholder="e.g. Priya Sharma"
                  {...regR('full_name', {
                    required: 'Full name is required',
                    minLength: { value: 2, message: 'At least 2 characters' },
                  })} />
                {errR.full_name && <span className="field-error">{errR.full_name.message}</span>}
              </div>
              <div className="form-group">
                <label>Email address</label>
                <input className={`form-control${errR.email ? ' input-error' : ''}`}
                  type="email" placeholder="you@example.com"
                  {...regR('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                  })} />
                {errR.email && <span className="field-error">{errR.email.message}</span>}
              </div>
              <div className="form-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input className={`form-control${errR.password ? ' input-error' : ''}`}
                    type={showRegPwd ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    {...regR('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' },
                    })} />
                  <button type="button" className="password-toggle" tabIndex={-1}
                    onClick={() => setShowRegPwd(v => !v)}
                    aria-label={showRegPwd ? 'Hide password' : 'Show password'}>
                    {showRegPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errR.password && <span className="field-error">{errR.password.message}</span>}
              </div>
              <div className="form-group">
                <label>Role</label>
                <select className="form-control" {...regR('role')}>
                  <option value="staff">Staff — View only</option>
                  <option value="manager">Manager — Full access</option>
                  <option value="admin">Admin — Full access + settings</option>
                </select>
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={loadingR}>
                {loadingR ? <span className="spinner" /> : 'Create Account →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
