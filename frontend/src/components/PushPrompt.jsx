import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, X, Share, Loader2 } from 'lucide-react'
import { api } from '../api'
import { enablePush, isIOS, isStandalone, pushPermission, pushSupported } from '../onesignal'

const DISMISS_KEY = 'strykd_push_prompt_dismissed'

/**
 * Subtle dashboard prompt to enable phone push notifications.
 * Shows from trial day 2 onward, once, until enabled or dismissed.
 * On iPhone (not yet installed) it shows add-to-home-screen instructions first,
 * because iOS only allows web push for installed PWAs.
 */
export default function PushPrompt({ trialDay, pushEnabled, userId, onEnabled }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const iosNeedsInstall = isIOS() && !isStandalone()

  // Eligibility: after day 2, not already enabled/granted, not dismissed,
  // and either push is supported here or we can show iOS install steps.
  const eligible =
    (trialDay == null || trialDay >= 2) &&
    !pushEnabled &&
    pushPermission() !== 'granted' &&
    !dismissed &&
    (pushSupported() || iosNeedsInstall)

  if (!eligible) return null

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }

  const enable = async () => {
    setBusy(true); setErr('')
    try {
      const granted = await enablePush(userId)
      if (granted) {
        await api.updateMe({ push_enabled: true }).catch(() => {})
        localStorage.setItem(DISMISS_KEY, '1')
        setDismissed(true)
        onEnabled?.()
      } else {
        setErr('Notifications are blocked. Enable them in your browser settings to get reminders.')
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div style={S.card} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <span style={S.iconWrap}><Bell size={18} color="var(--red)" /></span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ fontWeight: 700, marginBottom: 2 }}>Get streak reminders on your phone</p>
        {iosNeedsInstall ? (
          <p style={S.hint}>
            On iPhone, add Strykd to your Home Screen first: tap the <Share size={13} style={{ verticalAlign: -2 }} /> Share
            button, then <strong>Add to Home Screen</strong>. Open it from there to turn on notifications.
          </p>
        ) : (
          <p style={S.hint}>A quick nudge at 8pm if you haven't checked in, so you never break the streak.</p>
        )}
        {err && <p style={{ ...S.hint, color: 'var(--red)' }}>{err}</p>}
      </div>
      {!iosNeedsInstall && (
        <button className="pill pill-red pill-sm" onClick={enable} disabled={busy} style={{ flexShrink: 0 }}>
          {busy ? <Loader2 size={15} className="spin-icon" /> : <><Bell size={15} /> Enable</>}
        </button>
      )}
      <button onClick={dismiss} style={S.close} aria-label="Dismiss"><X size={16} /></button>
    </motion.div>
  )
}

const S = {
  card: {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    padding: '14px 18px', marginBottom: 24, borderRadius: 14,
    background: 'rgba(255,45,45,0.07)', border: '1px solid rgba(255,45,45,0.3)',
    color: 'var(--d-text)', fontSize: '0.92rem',
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'rgba(255,45,45,0.12)', display: 'grid', placeItems: 'center',
  },
  hint: { color: 'var(--d-text-dim)', fontSize: '0.82rem', lineHeight: 1.5, marginTop: 3 },
  close: { background: 'transparent', border: 'none', color: 'var(--d-text-muted)', padding: 4, cursor: 'pointer', flexShrink: 0 },
}
