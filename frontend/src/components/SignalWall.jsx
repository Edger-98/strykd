import { motion } from 'framer-motion'
import { inView } from '../motion'
import Avatar from './Avatar'

export default function SignalWall({ entries = [], dark = false, avatar, name }) {
  const c = dark
    ? { card: 'var(--d-card)', line: 'var(--d-line)', text: 'var(--d-text)', dim: 'var(--d-text-dim)', muted: 'var(--d-text-muted)' }
    : { card: 'var(--white)', line: 'var(--gray-line)', text: 'var(--ink)', dim: 'var(--gray-text)', muted: 'var(--gray-light)' }

  if (!entries.length) {
    return <p style={{ color: c.muted }}>No signal wall entries yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entries.map((entry, i) => {
        const pct = entry.tasks_total > 0 ? Math.round((entry.tasks_completed / entry.tasks_total) * 100) : 0
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView}
            transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            style={{ padding: '22px 26px', background: c.card, borderRadius: 16, borderLeft: '3px solid var(--red)',
              boxShadow: dark ? 'none' : 'var(--shadow-card)', border: dark ? `1px solid ${c.line}` : 'none', borderLeftWidth: 3, borderLeftColor: 'var(--red)', borderLeftStyle: 'solid' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(avatar || name) && <Avatar src={avatar} name={name} size={24} fontSize={10} />}
                <span style={{ fontSize: '0.72rem', color: c.muted, fontWeight: 700, letterSpacing: '0.1em' }}>
                  {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                </span>
              </span>
              <span style={{ fontSize: '0.78rem', color: c.dim }}>
                {entry.tasks_completed}/{entry.tasks_total}
                <span style={{ color: pct === 100 ? 'var(--blue)' : c.muted, marginLeft: 6 }}>{pct}%</span>
              </span>
            </div>
            <p style={{ color: c.text, lineHeight: 1.6, fontSize: '0.95rem' }}>{entry.ai_summary}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
