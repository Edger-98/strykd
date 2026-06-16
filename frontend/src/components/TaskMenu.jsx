import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Sparkles, Calendar, Camera, Trash2, ChevronRight } from 'lucide-react'
import { openGoogleCalendar, downloadIcs } from './AddToCalendar'

// On touch devices there's no hover, so the trigger stays faintly visible and
// tappable; on pointer devices it only shows on row hover (or while open).
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

/**
 * Understated per-row actions menu (kebab). Folds Ask AI, Add to calendar,
 * Upload proof, and Delete into one minimal dropdown so rows stay clean.
 *
 * Props: task, title, date, description, hover (row hover state),
 *        onAskAI(), onProof(), onDelete().
 */
export default function TaskMenu({ task, title, date, description, hover, onAskAI, onProof, onDelete }) {
  const [open, setOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const close = () => { setOpen(false); setCalOpen(false) }
  const pick = fn => e => { e.stopPropagation(); close(); fn && fn() }

  const toggle = e => {
    e.stopPropagation()
    if (!open) {
      const r = ref.current?.getBoundingClientRect()
      setDropUp(r ? window.innerHeight - r.bottom < 250 : false)
    }
    setOpen(o => !o)
  }

  const triggerOpacity = open ? 1 : isTouch ? 0.5 : (hover ? 0.85 : 0)

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button onClick={toggle} aria-label="Task actions" title="Task actions" aria-expanded={open}
        style={{ background: 'none', border: 'none', color: 'var(--d-text-muted)', padding: 4,
          display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: triggerOpacity, transition: 'opacity 0.15s' }}>
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div onClick={e => e.stopPropagation()}
          style={{ ...S.menu, ...(dropUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }) }}>
          <button style={S.item} onClick={pick(onAskAI)}><Sparkles size={15} /> Ask AI</button>

          <button style={S.item} onClick={e => { e.stopPropagation(); setCalOpen(o => !o) }}>
            <Calendar size={15} /> Add to calendar
            <ChevronRight size={14} style={{ marginLeft: 'auto', transform: calOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {calOpen && (
            <div style={{ paddingLeft: 14 }}>
              <button style={S.subItem} onClick={pick(() => openGoogleCalendar(title, date, description))}>Google Calendar</button>
              <button style={S.subItem} onClick={pick(() => downloadIcs(title, date, description))}>Apple Calendar</button>
            </div>
          )}

          <button style={S.item} onClick={pick(onProof)}>
            <Camera size={15} color={task.proof_url ? '#34C759' : undefined} />
            {task.proof_url ? 'Proof submitted' : 'Upload proof'}
          </button>

          <div style={S.divider} />
          <button style={{ ...S.item, color: 'var(--red)' }} onClick={pick(onDelete)}><Trash2 size={15} /> Delete</button>
        </div>
      )}
    </span>
  )
}

const S = {
  menu: {
    position: 'absolute', right: 0, zIndex: 55, minWidth: 184,
    background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 12,
    padding: 6, boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '9px 12px', borderRadius: 8,
    fontSize: '0.86rem', fontWeight: 500, color: 'var(--d-text)', cursor: 'pointer',
  },
  subItem: {
    display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500,
    color: 'var(--d-text-dim)', cursor: 'pointer',
  },
  divider: { height: 1, background: 'var(--d-line)', margin: '5px 6px' },
}
