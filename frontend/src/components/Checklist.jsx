import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { api } from '../api'

const VOICE = {
  direct: { label: 'DIRECT', color: '#0071E3' },
  motivational: { label: 'PUSH', color: '#FF2D2D' },
  reflective: { label: 'REFLECT', color: 'var(--d-text-dim)' },
}

export default function Checklist({ tasks = [], onUpdate }) {
  const [loading, setLoading] = useState({})

  const toggle = async task => {
    if (task.completed || loading[task.id]) return
    setLoading(p => ({ ...p, [task.id]: true }))
    try {
      const res = await api.completeTask(task.id)
      onUpdate && onUpdate(task.id, res)
    } catch (e) { console.error(e) }
    finally { setLoading(p => ({ ...p, [task.id]: false })) }
  }

  if (!tasks.length) {
    return <p style={{ color: 'var(--d-text-muted)', padding: '20px 0' }}>No tasks for today. Check back tomorrow.</p>
  }

  return (
    <div>
      {tasks.map((task, i) => {
        const v = VOICE[task.voice_style] || VOICE.direct
        return (
          <div key={task.id} onClick={() => toggle(task)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '18px 4px',
              borderBottom: i < tasks.length - 1 ? '1px solid var(--d-line)' : 'none',
              cursor: task.completed ? 'default' : 'pointer', opacity: loading[task.id] ? 0.5 : 1,
            }}>
            <motion.span className={`dash-check${task.completed ? ' checked' : ''}`}
              animate={task.completed ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 0.3 }}>
              {task.completed && <Check size={14} color="#fff" strokeWidth={3} />}
            </motion.span>

            <motion.span style={{ flex: 1, fontSize: '0.97rem', lineHeight: 1.5, color: task.completed ? 'var(--d-text-muted)' : 'var(--d-text)' }}
              animate={{ opacity: task.completed ? 0.55 : 1 }} transition={{ duration: 0.4 }}>
              <span style={{ position: 'relative' }}>
                {task.content}
                <motion.span style={{ position: 'absolute', left: 0, top: '50%', height: 1.5, background: 'currentColor' }}
                  initial={false} animate={{ width: task.completed ? '100%' : '0%' }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
              </span>
            </motion.span>

            <span style={{ flexShrink: 0, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
              color: v.color, border: `1px solid ${v.color}`, borderRadius: 5, padding: '2px 6px', opacity: 0.85 }}>
              {v.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
