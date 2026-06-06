import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { pageVariants } from '../motion'
import { api } from '../api'

export default function ResetPassword() {
  const { token } = useParams()
  const nav = useNavigate()
  const [state, setState] = useState('checking')  // checking | valid | invalid | done
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.validateResetToken(token)
      .then(() => setState('valid'))
      .catch(() => setState('invalid'))
  }, [token])

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setErr('Passwords do not match.'); return }
    setBusy(true)
    try {
      await api.resetPassword(token, password)
      setState('done')
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" style={S.shell}>
      <div className="card" style={S.card}>
        <span style={S.logo}>STRYKD</span>

        {state === 'checking' && <p style={{ color: 'var(--gray-text)', marginTop: 24 }}>Checking your link…</p>}

        {state === 'invalid' && (
          <>
            <h1 className="h-lg display" style={{ margin: '16px 0 8px' }}>Link expired.</h1>
            <p className="lead" style={{ fontSize: '1rem', marginBottom: 24 }}>
              This reset link is invalid or has expired. Request a fresh one from the login screen.
            </p>
            <button className="pill pill-dark" style={{ width: '100%' }} onClick={() => nav('/')}>Back to login</button>
          </>
        )}

        {state === 'valid' && (
          <>
            <h1 className="h-lg display" style={{ margin: '16px 0 8px' }}>Set a new password.</h1>
            <p className="lead" style={{ fontSize: '1rem', marginBottom: 24 }}>Choose something you'll remember.</p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="field" type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required />
              <input className="field" type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              {err && <p style={{ color: 'var(--red)', fontSize: '0.88rem' }}>{err}</p>}
              <button type="submit" className="pill pill-dark" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
                {busy ? <Loader2 size={18} className="spin-icon" /> : 'Reset password'}
              </button>
            </form>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 size={44} color="#34C759" style={{ margin: '20px 0 8px' }} />
            <h1 className="h-lg display" style={{ marginBottom: 8 }}>Password updated.</h1>
            <p className="lead" style={{ fontSize: '1rem', marginBottom: 24 }}>You can now log in with your new password.</p>
            <button className="pill pill-dark" style={{ width: '100%' }} onClick={() => nav('/')}>
              Go to login <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--gray-section)', display: 'grid', placeItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, padding: 'clamp(28px, 5vw, 44px)' },
  logo: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1rem', color: 'var(--ink)' },
}
