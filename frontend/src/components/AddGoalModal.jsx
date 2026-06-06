import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OnboardingWizard from './OnboardingWizard'
import { api } from '../api'

/**
 * Adds another goal without leaving the current page. Runs the same 8-step
 * wizard inside a light modal; on success calls onAdded() to refresh.
 */
export default function AddGoalModal({ open, onClose, onAdded }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async form => {
    setBusy(true); setError('')
    try {
      await api.onboard({ ...form, duration_days: Number(form.duration_days), hours_per_day: Number(form.hours_per_day) })
      setBusy(false)
      onAdded && onAdded()
      onClose && onClose()
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div onClick={busy ? undefined : onClose} style={S.backdrop}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={S.modalWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={S.card} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              onClick={e => e.stopPropagation()}>
              <OnboardingWizard onSubmit={submit} busy={busy} error={error} mode="add" onClose={busy ? undefined : onClose} />
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 70 },
  modalWrap: { position: 'fixed', inset: 0, zIndex: 71, display: 'grid', placeItems: 'center', padding: 'clamp(12px, 4vw, 40px)', overflowY: 'auto' },
  card: { width: '100%', maxWidth: 680, minHeight: 560, background: 'var(--white)', color: 'var(--ink)',
    borderRadius: 20, position: 'relative', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.4)' },
}
