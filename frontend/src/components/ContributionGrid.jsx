import { useState } from 'react'

/**
 * GitHub-style contribution grid, one square per day of the goal.
 *
 * Color coding:
 *   #CC0000 all tasks complete · #FF6B6B partial (>50%) · #FFB3B3 started (<=50%)
 *   #1a1a1a missed day · #111111 future day · pulsing red dot = today
 *
 * Props: days[], square=13, gap=3, dark=true, onPickDay(day)
 */
const C = {
  complete: '#CC0000',
  partial: '#FF6B6B',
  started: '#FFB3B3',
  missed: '#1a1a1a',
  future: '#111111',
}

function colorFor(day) {
  if (day.is_future) return C.future
  const { tasks_total: total, tasks_completed: done } = day
  if (!total) return C.missed // a past day with nothing scheduled reads as a gap
  const pct = done / total
  if (pct >= 1) return C.complete
  if (pct > 0.5) return C.partial
  if (pct > 0) return C.started
  return C.missed
}

function label(day) {
  const d = new Date(day.date + 'T12:00:00')
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (day.is_future) return `${date} · upcoming`
  if (!day.tasks_total) return `${date} · no tasks scheduled`
  return `${date} · ${day.tasks_completed}/${day.tasks_total} tasks complete`
}

export default function ContributionGrid({ days = [], square = 13, gap = 3, dark = true, onPickDay }) {
  const [hover, setHover] = useState(null) // { day, x, y }

  if (!days.length) return null

  // Leading blanks so the first day lands on its real weekday row (Sun..Sat)
  const offset = new Date(days[0].date + 'T12:00:00').getDay()

  const clickable = day => !day.is_future
  const legendBg = dark ? 'var(--d-text-muted)' : 'var(--gray-light)'

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(7, ${square}px)`,
          gridAutoFlow: 'column',
          gridAutoColumns: `${square}px`,
          gap: `${gap}px`,
          width: 'max-content',
        }}>
          {Array.from({ length: offset }).map((_, i) => <span key={`b${i}`} style={{ visibility: 'hidden' }} />)}
          {days.map(day => {
            const isToday = day.is_today
            return (
              <div
                key={day.date}
                className={isToday ? 'pulse-dot' : ''}
                onMouseEnter={e => setHover({ day, x: e.clientX, y: e.clientY })}
                onMouseMove={e => setHover({ day, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                onClick={() => clickable(day) && onPickDay && onPickDay(day)}
                style={{
                  width: square, height: square, borderRadius: Math.max(2, Math.round(square / 5)),
                  background: colorFor(day),
                  border: isToday ? '1.5px solid #FF2D2D' : '1px solid rgba(255,255,255,0.04)',
                  cursor: clickable(day) ? 'pointer' : 'default',
                  position: 'relative',
                }}
              >
                {isToday && (
                  <span style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: Math.max(4, Math.round(square / 3)), height: Math.max(4, Math.round(square / 3)),
                    borderRadius: '50%', background: '#FF2D2D',
                  }} />
                )}
                {day.proof_url && !day.is_video && !isToday && (
                  <img src={day.proof_url} alt="" style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', borderRadius: 'inherit', opacity: 0.92,
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
        fontSize: '0.72rem', color: dark ? 'var(--d-text-muted)' : 'var(--gray-light)' }}>
        <span>Less</span>
        {[C.missed, C.started, C.partial, C.complete].map(c => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 3, background: c,
            border: `1px solid ${legendBg}33` }} />
        ))}
        <span>More</span>
      </div>

      {hover && (
        <div style={{
          position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 90, pointerEvents: 'none',
          background: dark ? 'var(--d-card)' : '#fff', color: dark ? 'var(--d-text)' : 'var(--ink)',
          border: `1px solid ${dark ? 'var(--d-line)' : 'var(--gray-line)'}`,
          borderRadius: 8, padding: '7px 11px', fontSize: '0.8rem', fontWeight: 500,
          boxShadow: '0 6px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
        }}>
          {label(hover.day)}
        </div>
      )}
    </div>
  )
}
