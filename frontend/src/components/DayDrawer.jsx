import { AnimatePresence, motion } from 'framer-motion'
import { X, Check, Calendar, TrendingUp } from 'lucide-react'

const fmt = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Slide-in day detail: tasks, daily proof, and the signal wall entry.
 * Themeable via `dark` so it fits the dashboard (dark) and public page (light).
 */
export default function DayDrawer({ day, onClose, dark = true, accent = '#FF2D2D' }) {
  const c = dark
    ? { panel: 'var(--d-panel)', card: 'var(--d-card)', line: 'var(--d-line)', text: 'var(--d-text)', dim: 'var(--d-text-dim)', muted: 'var(--d-text-muted)' }
    : { panel: '#fff', card: 'var(--gray-section)', line: 'var(--gray-line)', text: 'var(--ink)', dim: 'var(--gray-text)', muted: 'var(--gray-light)' }

  return (
    <AnimatePresence>
      {day && (
        <>
          <motion.div onClick={onClose} style={S.backdrop}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={{ ...S.drawer, background: c.panel, borderLeft: `1px solid ${c.line}`, color: c.text }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700,
                  color: day.is_future ? 'var(--blue)' : accent }}>
                  {day.is_today ? 'TODAY' : day.is_future ? 'PLANNED' : 'PAST'}
                </p>
                <h2 className="display" style={{ fontSize: '1.4rem', marginTop: 4 }}>Day {day.day_number}</h2>
                <p style={{ color: c.muted, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={13} /> {fmt(day.date)}
                  {day.tasks_total > 0 && <span style={{ marginLeft: 6 }}>· {day.tasks_completed}/{day.tasks_total} done</span>}
                </p>
              </div>
              <button onClick={onClose} style={{ ...S.icon, color: c.dim }} aria-label="Close"><X size={18} /></button>
            </div>

            {day.proof_url && (
              <>
                <p style={{ ...S.label, color: c.muted }}>Daily proof</p>
                <a href={day.proof_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                  {day.is_video
                    ? <video src={day.proof_url} style={{ ...S.proof, border: `1px solid ${c.line}` }} controls />
                    : <img src={day.proof_url} alt="daily proof" style={{ ...S.proof, border: `1px solid ${c.line}` }} />}
                </a>
              </>
            )}

            <p style={{ ...S.label, color: c.muted }}>{day.is_future ? "What's planned" : 'Tasks'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {day.tasks?.length ? day.tasks.map((t, i) => (
                <div key={i} style={{ ...S.task, background: c.card }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center',
                    border: `2px solid ${t.completed ? accent : c.line}`, background: t.completed ? accent : 'transparent' }}>
                    {t.completed && <Check size={11} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1.45, color: t.completed ? c.muted : c.text,
                    textDecoration: t.completed ? 'line-through' : 'none' }}>{t.content}</span>
                </div>
              )) : <p style={{ color: c.muted, fontSize: '0.9rem' }}>No tasks for this day.</p>}
            </div>

            {day.signal && (
              <>
                <p style={{ ...S.label, color: c.muted, marginTop: 28 }}>
                  <TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Signal wall
                </p>
                <div style={{ ...S.signal, background: c.card, borderLeft: `3px solid ${accent}` }}>
                  <div style={{ fontSize: '0.74rem', color: c.muted, marginBottom: 6 }}>
                    {day.signal.tasks_completed}/{day.signal.tasks_total} tasks
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{day.signal.ai_summary}</p>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', zIndex: 80 },
  drawer: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 81,
    padding: 28, overflowY: 'auto', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' },
  icon: { background: 'transparent', border: 'none', padding: 4, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  label: { fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase', margin: '24px 0 12px' },
  task: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12 },
  signal: { padding: '16px 18px', borderRadius: 12 },
  proof: { width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, display: 'block' },
}
