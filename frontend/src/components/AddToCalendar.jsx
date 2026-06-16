import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

const ymd = d => d.replace(/-/g, '')                       // YYYY-MM-DD -> YYYYMMDD
const nextDay = iso => {                                   // all-day end is exclusive
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
const icsEscape = s => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

// Standalone actions so other UIs (e.g. the task action menu) can add to
// calendar without rendering this component's own dropdown.
export function openGoogleCalendar(title, date, description = '') {
  const day = date || new Date().toISOString().slice(0, 10)
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${ymd(day)}/${ymd(nextDay(day))}`
    + `&details=${encodeURIComponent(description)}`
  window.open(url, '_blank', 'noopener')
}

export function downloadIcs(title, date, description = '') {
  const day = date || new Date().toISOString().slice(0, 10)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Strykd//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@strykdapp.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(day)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(day))}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'strykd-task.ics'
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * "Add to Calendar" control: a small dropdown with Google (URL) and Apple (.ics).
 * No OAuth. Props: title, date (YYYY-MM-DD), description, dark.
 */
export default function AddToCalendar({ title, date, description = '', dark = true, size = 16 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const day = date || new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const google = () => { openGoogleCalendar(title, day, description); setOpen(false) }
  const apple = () => { downloadIcs(title, day, description); setOpen(false) }

  const c = dark
    ? { fg: 'var(--d-text-muted)', menu: 'var(--d-card)', line: 'var(--d-line)', text: 'var(--d-text)' }
    : { fg: 'var(--gray-light)', menu: 'var(--white)', line: 'var(--gray-line)', text: 'var(--ink)' }

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} aria-label="Add to calendar" title="Add to calendar"
        style={{ background: 'none', border: 'none', color: c.fg, padding: 4, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <Calendar size={size} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 40, minWidth: 168,
          background: c.menu, border: `1px solid ${c.line}`, borderRadius: 12, padding: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
          <button onClick={google} style={{ ...menuItem, color: c.text }}>Google Calendar</button>
          <button onClick={apple} style={{ ...menuItem, color: c.text }}>Apple Calendar</button>
        </div>
      )}
    </span>
  )
}

const menuItem = {
  display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
  padding: '9px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
}
