import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OnboardingWizard from './OnboardingWizard'
import OnboardingStream from './OnboardingStream'

/**
 * Adds another goal without leaving the current page. Runs the same 8-step
 * wizard inside a light modal, then the full-screen cinematic streaming build.
 * On success calls onAdded() to refresh.
 */
export default function AddGoalModal({ open, onClose, onAdded }) {
  const [phase, setPhase] = useState('wizard') // 'wizard' | 'streaming'
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  // Reset when the modal is dismissed so reopening starts fresh
  useEffect(() => {
    if (!open) { setPhase('wizard'); setForm(null); setError('') }
  }, [open])

  const submit = f => {
    setForm({ ...f, duration_days: Number(f.duration_days), hours_per_day: Number(f.hours_per_day) })
    setError('')
    setPhase('streaming')
  }

  const showStream = open && phase === 'streaming' && form
  const showWizard = open && phase === 'wizard'

  return (
    <AnimatePresence>
      {/* Full-screen cinematic build (covers the dashboard while generating) */}
      {showStream && (
        <OnboardingStream
          key="stream"
          form={form}
          onDone={() => { onAdded && onAdded(); onClose && onClose() }}
          onCancel={() => { setError('Something interrupted the build. Your answers are below.'); setPhase('wizard') }}
        />
      )}

      {showWizard && (
        <motion.div key="backdrop" onClick={onClose} style={S.backdrop}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      )}
      {showWizard && (
        <motion.div key="wrap" style={S.modalWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div style={S.card} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onClick={e => e.stopPropagation()}>
            <OnboardingWizard onSubmit={submit} busy={false} error={error} mode="add"
              onClose={onClose} initialForm={form || undefined} />
          </motion.div>
        </motion.div>
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
