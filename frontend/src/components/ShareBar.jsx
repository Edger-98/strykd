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

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = (text || '').split(' ')
  let line = '', lines = []
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  lines = lines.slice(0, maxLines)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return y + lines.length * lineH
}

/**
 * Share controls: X + LinkedIn intents and an Instagram-ready square image card
 * (name, goal, streak, contribution grid) generated on a canvas for download.
 */
export default function ShareBar({ goal = 'my goal', streakDays = 0, day, publicUrl = '', name = '', grid = [], dark = true, label = 'Share' }) {
  const n = day || streakDays || 1
  const tweet = `I'm on day ${n} of my ${goal} on Strykd. Check my progress: ${publicUrl} #accountability #strykd`

  const shareX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank', 'noopener')

  const shareLinkedIn = () => {
    const caption = `Day ${n} of ${goal}. I'm building accountability in public with Strykd, one day at a time. ${publicUrl} #accountability #strykd`
    navigator.clipboard?.writeText(caption).catch(() => {})
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, '_blank', 'noopener')
  }

  const shareInstagram = () => {
    const S = 1080
    const cv = document.createElement('canvas')
    cv.width = S; cv.height = S
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S)
    // brand
    ctx.fillStyle = '#fff'; ctx.font = '800 40px -apple-system, Helvetica, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText('S T R Y K D', 80, 80)
    ctx.fillStyle = '#FF2D2D'; ctx.fillRect(80, 140, 80, 6)
    // name
    if (name) { ctx.fillStyle = '#9A9A9A'; ctx.font = '500 30px -apple-system, Helvetica, sans-serif'; ctx.fillText(name.toUpperCase(), 80, 200) }
    // goal
    ctx.fillStyle = '#fff'; ctx.font = '800 60px -apple-system, Helvetica, sans-serif'
    const afterGoal = wrap(ctx, goal, 80, 260, S - 160, 72, 3)
    // streak
    ctx.fillStyle = '#FF2D2D'; ctx.font = '800 150px -apple-system, Helvetica, sans-serif'
    ctx.fillText(String(n), 80, afterGoal + 40)
    const numW = ctx.measureText(String(n)).width
    ctx.fillStyle = '#9A9A9A'; ctx.font = '700 30px -apple-system, Helvetica, sans-serif'
    ctx.fillText('DAY', 80 + numW + 28, afterGoal + 90)
    ctx.fillText('STREAK', 80 + numW + 28, afterGoal + 128)
    // contribution grid (last ~14 weeks), bottom area
    const days = grid.slice(-98)
    const cell = 22, gap = 6, cols = Math.ceil(days.length / 7)
    const gx = 80, gy = S - 80 - 7 * (cell + gap)
    const offset = days.length ? new Date(days[0].date + 'T12:00:00').getDay() : 0
    days.forEach((d, i) => {
      const idx = i + offset
      const col = Math.floor(idx / 7), row = idx % 7
      ctx.fillStyle = colorFor(d)
      ctx.fillRect(gx + col * (cell + gap), gy + row * (cell + gap), cell, cell)
    })
    // footer
    const slug = (publicUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
    ctx.fillStyle = '#5C5C5C'; ctx.font = '600 26px -apple-system, Helvetica, sans-serif'
    ctx.fillText(slug || 'strykdapp.com', 80, S - 56)

    const a = document.createElement('a')
    a.href = cv.toDataURL('image/png')
    a.download = 'strykd-progress.png'
    a.click()
  }

  const c = dark ? { bd: 'var(--d-line)', fg: 'var(--d-text-dim)', bg: 'var(--d-card)' }
    : { bd: 'var(--gray-line)', fg: 'var(--gray-text)', bg: 'var(--white)' }
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 50,
    background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {label && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.fg, fontSize: '0.8rem', fontWeight: 600 }}><Share2 size={14} /> {label}</span>}
      <button style={btn} onClick={shareX}><strong style={{ fontSize: '0.95rem', lineHeight: 1 }}>𝕏</strong> Post</button>
      <button style={btn} onClick={shareLinkedIn}><strong style={{ fontWeight: 800 }}>in</strong> LinkedIn</button>
      <button style={btn} onClick={shareInstagram}><Camera size={15} /> Instagram</button>
    </div>
  )
}
