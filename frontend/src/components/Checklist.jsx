import { useState } from 'react'
import { api } from '../api'

const VOICE_COLORS = { direct: '#4A9EFF', motivational: '#E85D04', reflective: '#4CAF7A' }
const VOICE_LABEL = { direct: 'DO', motivational: 'GO', reflective: 'FEEL' }

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
    return (
      <p style={{ color: 'var(--fg-muted)', fontStyle: 'italic', padding: '1rem 0' }}>
        No tasks for today. Check back tomorrow.
      </p>
    )
  }

  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {tasks.map(task => (
        <li
          key={task.id}
          onClick={() => toggle(task)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'var(--bg-card)',
            border: `1px solid ${task.completed ? 'var(--accent-dim)' : 'var(--border)'}`,
            borderRadius: '8px',
            cursor: task.completed ? 'default' : 'pointer',
            opacity: loading[task.id] ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          {/* Checkbox */}
          <span style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2px solid ${task.completed ? 'var(--accent)' : 'var(--border)'}`,
            background: task.completed ? 'var(--accent)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}>
            {task.completed && (
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                <path d="M1 4L4.5 7.5L11 1" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </span>

          <span style={{ flex: 1 }}>
            <span style={{
              display: 'block',
              color: task.completed ? 'var(--fg-muted)' : 'var(--fg)',
              textDecoration: task.completed ? 'line-through' : 'none',
              lineHeight: 1.45,
              fontSize: '0.95rem',
            }}>
              {task.content}
            </span>
          </span>

          {/* Voice badge */}
          <span style={{
            flexShrink: 0,
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: VOICE_COLORS[task.voice_style] || '#888',
            padding: '2px 6px',
            border: `1px solid ${VOICE_COLORS[task.voice_style] || '#888'}`,
            borderRadius: 4,
            opacity: 0.8,
          }}>
            {VOICE_LABEL[task.voice_style] || task.voice_style}
          </span>
        </li>
      ))}
    </ul>
  )
}
