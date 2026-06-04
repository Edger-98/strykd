import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api'

export default function Landing() {
  const nav = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', slug: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = mode === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form)
      setToken(res.access_token)
      nav(mode === 'login' ? '/dashboard' : '/onboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = {
    width: '100%', padding: '0.75rem 1rem', marginBottom: '0.85rem',
    background: '#1A100A', color: '#F5F0EB',
    border: '1px solid #3D1F10', borderRadius: 8, fontSize: '0.95rem', outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#0D0805', color: '#F5F0EB', padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{
          fontSize: '3rem', fontWeight: 900, letterSpacing: '0.04em',
          textAlign: 'center', marginBottom: '0.5rem',
          fontFamily: '"Arial Black", Impact, sans-serif',
        }}>STRYKD</h1>
        <p style={{ textAlign: 'center', color: '#A89080', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          AI-powered accountability. Live on your own subdomain.
        </p>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <input style={input} placeholder="Your name" value={form.name} onChange={upd('name')} required />
              <input style={input} placeholder="Identity slug (e.g. edger)" value={form.slug}
                     onChange={upd('slug')} required pattern="[a-z0-9-]+" />
            </>
          )}
          <input style={input} type="email" placeholder="Email" value={form.email} onChange={upd('email')} required />
          <input style={input} type="password" placeholder="Password" value={form.password} onChange={upd('password')} required />

          {error && <p style={{ color: '#E85D04', fontSize: '0.85rem', marginBottom: '0.85rem' }}>{error}</p>}

          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '0.85rem', background: '#E85D04', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem',
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#A89080', fontSize: '0.88rem' }}>
          {mode === 'login' ? "No account yet?" : 'Already have one?'}{' '}
          <button
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#E85D04', fontWeight: 600 }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
