import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { pageVariants } from '../motion'
import { api } from '../api'

export default function Unsubscribe() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [state, setState] = useState('loading') // loading | done | error
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setState('error'); setMsg('This unsubscribe link is missing its token.'); return }
    api.unsubscribe(token)
      .then(r => { setState('done'); setMsg(r.message || 'You have been unsubscribed from Strykd emails.') })
      .catch(e => { setState('error'); setMsg(e.message || 'This unsubscribe link is invalid or expired.') })
  }, [params])

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" style={S.shell}>
      <div style={S.inner}>
        <button onClick={() => nav('/')} style={S.logo}>STRYKD</button>

        <div style={S.card}>
          {state === 'loading' && (
            <>
              <Loader2 size={28} className="spin-icon" style={{ color: 'var(--gray-text)' }} />
              <p style={S.lead}>Updating your email preferences…</p>
            </>
          )}
          {state === 'done' && (
            <>
              <div style={{ ...S.iconWrap, background: 'rgba(52,199,89,0.12)' }}><Check size={26} color="#34C759" /></div>
              <h1 className="display" style={S.h1}>You have been unsubscribed from Strykd emails</h1>
              <p style={S.lead}>
                You won't receive reminder or update emails anymore. You can turn them back on
                any time from your account settings.
              </p>
            </>
          )}
          {state === 'error' && (
            <>
              <div style={{ ...S.iconWrap, background: 'rgba(255,45,45,0.1)' }}><AlertTriangle size={24} color="var(--red)" /></div>
              <h1 className="display" style={S.h1}>We couldn't process that link</h1>
              <p style={S.lead}>{msg}</p>
            </>
          )}

          <div style={S.foot}>
            <button onClick={() => nav('/dashboard/settings')} className="pill pill-dark pill-sm">Manage email preferences</button>
            <button onClick={() => nav('/')} style={S.back}><ArrowLeft size={15} /> Back to home</button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--white)', color: 'var(--ink)', display: 'grid', placeItems: 'center', padding: '56px 24px' },
  inner: { maxWidth: 520, width: '100%', textAlign: 'center' },
  logo: { background: 'none', border: 'none', fontWeight: 800, letterSpacing: '0.14em', fontSize: '1.05rem', color: 'var(--ink)', cursor: 'pointer' },
  card: { marginTop: 32, padding: '40px 32px', border: '1px solid var(--gray-line)', borderRadius: 20, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', marginBottom: 20 },
  h1: { fontSize: '1.5rem', lineHeight: 1.25, marginBottom: 12 },
  lead: { color: 'var(--gray-text)', fontSize: '1rem', lineHeight: 1.6, marginTop: 8 },
  foot: { marginTop: 28, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--gray-text)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' },
}
