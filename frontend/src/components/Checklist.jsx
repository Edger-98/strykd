import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../api'

const VOICE = {
  direct: { label: 'DIRECT', color: 'var(--blue)' },
  motivational: { label: 'PUSH', color: 'var(--red)' },
  reflective: { label: 'REFLECT', color: 'var(--text-dim)' },
}

export default function Checklist({ tasks = [], onUpdate }) {
  const [loading, setLoading] = useState({})

  const toggle = async task => {
    if (task.completed || loading[task.id]) return
    setLoading(p => ({ ...p, [task.id]: true }))
    try {
      const res = await api.completeTask(task.id)
      onUpdate && onUpdate(task.id, res.streak_days)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(p => ({ ...p, [task.id]: false }))
    }
  }

  if (!tasks.length) {
    return <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No tasks for today. Check back tomorrow.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {tasks.map(task => {
        const v = VOICE[task.voice_style] || VOICE.direct
        return (
          <div key={task.id} onClick={() => toggle(task)}
            className="card"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '1rem 1.1rem',
              cursor: task.completed ? 'default' : 'pointer',
              borderColor: task.completed ? 'var(--line)' : 'var(--line)',
              opacity: loading[task.id] ? 0.5 : 1,
            }}>
            {/* checkbox */}
            <span style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: 7,
              border: `2px solid ${task.completed ? 'var(--blue)' : 'var(--line-bright)'}`,
              background: task.completed ? 'var(--blue)' : 'transparent',
              display: 'grid', placeItems: 'center', transition: 'all 0.18s var(--ease-out)',
            }}>
              {task.completed && <Check size={14} color="var(--black)" strokeWidth={3} />}
            </span>

            <span style={{
              flex: 1, fontSize: '0.96rem', lineHeight: 1.45,
              color: task.completed ? 'var(--text-muted)' : 'var(--white)',
              textDecoration: task.completed ? 'line-through' : 'none',
            }}>
              {task.content}
            </span>

            <span style={{
              flexShrink: 0, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
              color: v.color, border: `1px solid ${v.color}`, borderRadius: 5,
              padding: '2px 6px', opacity: 0.85,
            }}>
              {v.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
