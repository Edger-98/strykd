import { useState } from 'react'
import { Share2, Camera } from 'lucide-react'

function colorFor(d) {
  if (d.is_future) return '#1c1c1c'
  const t = d.tasks_total, c = d.tasks_completed
  if (!t) return '#1a1a1a'
  const p = c / t
  if (p >= 1) return '#CC0000'
  if (p > 0.5) return '#FF6B6B'
  if (p > 0) return '#FFB3B3'
  return '#1a1a1a'
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapCenter(ctx, text, cx, y, maxW, lineH, maxLines) {
  const words = (text || '').split(' ')
  let line = '', lines = []
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  lines = lines.slice(0, maxLines)
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH))
  return y + lines.length * lineH
}

function flame(ctx, cx, cy, s) {
  ctx.fillStyle = '#FF2D2D'
  ctx.beginPath()
  ctx.moveTo(cx, cy - s)
  ctx.bezierCurveTo(cx + s * 0.78, cy - s * 0.25, cx + s * 0.62, cy + s * 0.7, cx, cy + s)
  ctx.bezierCurveTo(cx - s * 0.62, cy + s * 0.7, cx - s * 0.78, cy - s * 0.25, cx, cy - s)
  ctx.fill()
  ctx.fillStyle = '#FF9F0A'
  ctx.beginPath()
  ctx.moveTo(cx, cy - s * 0.35)
  ctx.bezierCurveTo(cx + s * 0.42, cy + s * 0.05, cx + s * 0.3, cy + s * 0.6, cx, cy + s * 0.7)
  ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.6, cx - s * 0.42, cy + s * 0.05, cx, cy - s * 0.35)
  ctx.fill()
}

const isMobile = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

/**
 * Share controls: X + LinkedIn intents and a 1080x1080 Instagram-ready PNG card
 * (logo top-left, goal centered, streak with flame, contribution grid,
 * Day X of Y, username). Downloads as strykd-share.png.
 */
export default function ShareBar({ goals = [], name = '', slug = '', publicUrl = '', dark = true, label = 'Share' }) {
  const [hint, setHint] = useState(false)
  const active = goals.filter(g => g && (g.status ? g.status === 'active' : true))
  const primary = active[0] || {}
  const p = primary.progress || {}
  const streak = primary.streak_days || 0
  const day = p.day || 1
  const total = p.total_days || primary.duration_days || '?'

  const tweet = `I'm on day ${day} of my ${primary.description || 'goal'} on Strykd. Check my progress: ${publicUrl} #accountability #strykd`
  const shareX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank', 'noopener')
  const shareLinkedIn = () => {
    const caption = `Day ${day} of ${primary.description || 'my goal'}. I'm building accountability in public with Strykd. ${publicUrl} #accountability #strykd`
    navigator.clipboard?.writeText(caption).catch(() => {})
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, '_blank', 'noopener')
  }

  const shareInstagram = () => {
    const S = 1080, PADX = 80
    const cv = document.createElement('canvas')
    cv.width = S; cv.height = S
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S)
    ctx.textBaseline = 'top'

    // logo top-left
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '800 34px -apple-system, Helvetica, sans-serif'
    ctx.fillText('S T R Y K D', PADX, 70)
    ctx.fillStyle = '#FF2D2D'; roundRect(ctx, PADX, 116, 70, 5, 3); ctx.fill()

    // goal centered
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 72px -apple-system, Helvetica, sans-serif'
    const goalText = primary.description || 'My goal'
    const afterGoal = wrapCenter(ctx, goalText, S / 2, 300, S - PADX * 2, 84, 3)

    // streak with flame
    const sy = afterGoal + 56
    ctx.fillStyle = '#FF2D2D'; ctx.font = '800 120px -apple-system, Helvetica, sans-serif'
    const numStr = String(streak)
    const numW = ctx.measureText(numStr).width
    flame(ctx, S / 2 - numW / 2 - 50, sy + 64, 46)
    ctx.textAlign = 'left'
    ctx.fillText(numStr, S / 2 - numW / 2, sy)
    ctx.textAlign = 'center'; ctx.fillStyle = '#8A8A8A'; ctx.font = '700 26px -apple-system, Helvetica, sans-serif'
    ctx.fillText('DAY STREAK', S / 2, sy + 132)

    // contribution grid (github style, last ~98 non-future days), centered
    const days = (primary.grid || []).filter(d => !d.is_future).slice(-98)
    const cell = 20, gap = 6
    const offset = days.length ? new Date(days[0].date + 'T12:00:00').getDay() : 0
    const cols = Math.ceil((days.length + offset) / 7)
    const gridW = cols * (cell + gap) - gap
    const gx = (S - gridW) / 2, gy = sy + 210
    days.forEach((d, i) => {
      const idx = i + offset, col = Math.floor(idx / 7), row = idx % 7
      ctx.fillStyle = colorFor(d)
      roundRect(ctx, gx + col * (cell + gap), gy + row * (cell + gap), cell, cell, 4); ctx.fill()
    })

    // bottom row: Day X of Y (left), username (right)
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 30px -apple-system, Helvetica, sans-serif'
    ctx.fillText(`Day ${day} of ${total}`, PADX, S - 86)
    ctx.textAlign = 'right'; ctx.fillStyle = '#8A8A8A'; ctx.font = '600 28px -apple-system, Helvetica, sans-serif'
    ctx.fillText('@' + (slug || 'strykd'), S - PADX, S - 84)

    const a = document.createElement('a')
    a.href = cv.toDataURL('image/png')
    a.download = 'strykd-share.png'
    a.click()
    if (isMobile()) { setHint(true); setTimeout(() => setHint(false), 6000) }
  }

  const c = dark ? { bd: 'var(--d-line)', fg: 'var(--d-text-dim)', bg: 'var(--d-card)' }
    : { bd: 'var(--gray-line)', fg: 'var(--gray-text)', bg: 'var(--white)' }
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 50,
    background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {label && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.fg, fontSize: '0.8rem', fontWeight: 600 }}><Share2 size={14} /> {label}</span>}
        <button style={btn} onClick={shareX}><strong style={{ fontSize: '0.95rem', lineHeight: 1 }}>𝕏</strong> Post</button>
        <button style={btn} onClick={shareLinkedIn}><strong style={{ fontWeight: 800 }}>in</strong> LinkedIn</button>
        <button style={btn} onClick={shareInstagram}><Camera size={15} /> Instagram</button>
      </div>
      {hint && (
        <p style={{ marginTop: 10, fontSize: '0.82rem', color: c.fg, fontWeight: 600 }}>
          Saved. Save the image, then post it to your Instagram Stories.
        </p>
      )}
    </div>
  )
}
