import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, Zap } from 'lucide-react'
import GridBackground from '../components/GridBackground'
import { api, setToken } from '../api'

export default function Landing() {
  const nav = useNavigate()
  const [view, setView] = useState('hero') // 'hero' | 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', slug: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const res = view === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form)
      setToken(res.access_token)
      nav(view === 'login' ? '/dashboard' : '/onboard')
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <GridBackground wash="red" />

      {/* Nav */}
      <nav style={S.nav} className="anim-fade">
        <span style={S.brand}>STRYKD</span>
        {view === 'hero' && (
          <button className="pill pill-outline pill-sm" onClick={() => setView('login')}>
            Log in
          </button>
        )}
      </nav>

      {view === 'hero' ? (
        <Hero onStart={() => setView('register')} onLogin={() => setView('login')} />
      ) : (
        <AuthForm
          view={view} form={form} upd={upd} submit={submit}
          error={error} busy={busy}
          toggle={() => { setView(view === 'login' ? 'register' : 'login'); setError('') }}
          back={() => { setView('hero'); setError('') }}
        />
      )}
    </div>
  )
}

function Hero({ onStart, onLogin }) {
  return (
    <main style={S.hero}>
      <div className="pill pill-outline pill-sm anim-up d1" style={{ marginBottom: '2.5rem', cursor: 'default', borderColor: 'var(--line)' }}>
        <Zap size={14} color="var(--blue)" /> AI-powered accountability
      </div>

      <h1 className="display h-mega anim-up-lg d2" style={{ maxWidth: 1000 }}>
        Become who you<br />said you'd <span className="gradient-rb">become.</span>
      </h1>

      <p className="anim-up d4" style={S.heroSub}>
        Describe your goal. The AI builds your daily plan, your visual identity,
        and a live page on your own subdomain. Show up. Check off. Don't break the streak.
      </p>

      <div className="anim-up d6" style={S.ctaRow}>
        <button className="pill pill-red pill-lg" onClick={onStart}>
          Start now <ArrowRight size={18} />
        </button>
        <button className="pill pill-outline pill-lg" onClick={onLogin}>
          Log in
        </button>
      </div>
    </main>
  )
}

function AuthForm({ view, form, upd, submit, error, busy, toggle, back }) {
  return (
    <main style={S.authWrap}>
      <form onSubmit={submit} className="anim-up" style={S.authCard}>
        <h2 className="display h-lg" style={{ marginBottom: '0.5rem' }}>
          {view === 'login' ? 'Welcome back.' : 'Create your account.'}
        </h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          {view === 'login' ? 'Pick up where you left off.' : 'Your subdomain is waiting.'}
        </p>

        {view === 'register' && (
          <>
            <input className="field" style={S.mb} placeholder="Your name" value={form.name} onChange={upd('name')} required />
            <input className="field" style={S.mb} placeholder="Identity slug (e.g. edger)" value={form.slug}
                   onChange={upd('slug')} required pattern="[a-z0-9-]+" title="lowercase letters, numbers, hyphens" />
          </>
        )}
        <input className="field" style={S.mb} type="email" placeholder="Email" value={form.email} onChange={upd('email')} required />
        <input className="field" style={S.mb} type="password" placeholder="Password" value={form.password} onChange={upd('password')} required />

        {error && <p style={S.err}>{error}</p>}

        <button type="submit" className="pill pill-red" disabled={busy} style={{ width: '100%', marginTop: '0.5rem' }}>
          {busy ? <Loader2 size={18} className="cursor-blink" /> : (view === 'login' ? 'Log in' : 'Create account')}
        </button>

        <div style={S.authFoot}>
          <button type="button" onClick={toggle} style={S.linkBtn}>
            {view === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
          <button type="button" onClick={back} style={{ ...S.linkBtnDim, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </form>
    </main>
  )
}

const S = {
  nav: {
    position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto',
  },
  brand: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1.05rem' },
  hero: {
    position: 'relative', zIndex: 1, minHeight: '82vh', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '0 1.5rem',
  },
  heroSub: {
    color: 'var(--text-dim)', fontSize: 'clamp(1rem, 2vw, 1.25rem)', lineHeight: 1.6,
    maxWidth: 600, marginTop: '2rem',
  },
  ctaRow: { display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' },
  authWrap: {
    position: 'relative', zIndex: 1, minHeight: '78vh', display: 'grid', placeItems: 'center',
    padding: '0 1.5rem',
  },
  authCard: {
    width: '100%', maxWidth: 420, background: 'var(--surface)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '2.5rem',
  },
  mb: { marginBottom: '0.85rem' },
  err: { color: 'var(--red)', fontSize: '0.85rem', marginBottom: '0.85rem' },
  authFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, fontSize: '0.85rem' },
  linkBtnDim: { background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' },
}
