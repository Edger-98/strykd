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

const areaLabel = a => (a || 'goal').replace(/[-_]/g, ' ').toUpperCase()

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
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
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + '…', maxW) }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return y + lines.length * lineH
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

/**
 * Share controls: X + LinkedIn intents and an Instagram-ready square image card
 * showing ALL active goals (name, life area, day progress, %, 14-day mini grid),
 * total streak, and the primary goal's projected outcome. Downloads as PNG.
 *
 * Props: goals[] (each with description, life_area, progress{day,total_days,pct},
 * streak_days, grid[], projected_outcome), name, slug, publicUrl.
 */
export default function ShareBar({ goals = [], name = '', slug = '', publicUrl = '', dark = true, label = 'Share' }) {
  const active = goals.filter(g => g && (g.status ? g.status === 'active' : true))
  const primary = active[0] || {}
  const totalStreak = active.reduce((s, g) => s + (g.streak_days || 0), 0)
  const primaryDay = primary.progress?.day || primary.streak_days || 1

  const tweet = `I'm on day ${primaryDay} of my ${primary.description || 'goal'} on Strykd. Check my progress: ${publicUrl} #accountability #strykd`
  const shareX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank', 'noopener')
  const shareLinkedIn = () => {
    const caption = `Day ${primaryDay} of ${primary.description || 'my goal'}. I'm building accountability in public with Strykd, one day at a time. ${publicUrl} #accountability #strykd`
    navigator.clipboard?.writeText(caption).catch(() => {})
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, '_blank', 'noopener')
  }

  const shareInstagram = () => {
    const S = 1080
    const cv = document.createElement('canvas')
    cv.width = S; cv.height = S
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S)
    ctx.textBaseline = 'top'

    // ── header (centered) ──
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'; ctx.font = '800 42px -apple-system, Helvetica, sans-serif'
    ctx.fillText('S T R Y K D', S / 2, 64)
    ctx.fillStyle = '#FF2D2D'; roundRect(ctx, S / 2 - 44, 122, 88, 6, 3); ctx.fill()
    if (name) { ctx.fillStyle = '#fff'; ctx.font = '800 38px -apple-system, Helvetica, sans-serif'; ctx.fillText(name, S / 2, 156) }
    if (slug) { ctx.fillStyle = '#7A7A7A'; ctx.font = '600 26px -apple-system, Helvetica, sans-serif'; ctx.fillText('@' + slug, S / 2, 206) }
    ctx.textAlign = 'left'

    // ── goals ──
    const shown = active.slice(0, 3)
    const remaining = active.length - shown.length
    const PADX = 72
    let y = 270
    const rowH = 168

    shown.forEach(g => {
      const p = g.progress || {}
      // goal name
      ctx.fillStyle = '#fff'; ctx.font = '800 40px -apple-system, Helvetica, sans-serif'
      ctx.fillText(ellipsize(ctx, g.description || 'My goal', S - PADX * 2 - 130), PADX, y)
      // percentage (right)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#FF2D2D'; ctx.font = '800 40px -apple-system, Helvetica, sans-serif'
      ctx.fillText(`${p.pct ?? 0}%`, S - PADX, y)
      ctx.textAlign = 'left'
      // meta: area label + Day X of Y
      ctx.fillStyle = '#FF6B6B'; ctx.font = '700 22px -apple-system, Helvetica, sans-serif'
      const area = areaLabel(g.life_area)
      ctx.fillText(area, PADX, y + 54)
      const areaW = ctx.measureText(area).width
      ctx.fillStyle = '#8A8A8A'; ctx.font = '600 22px -apple-system, Helvetica, sans-serif'
      ctx.fillText(`·  Day ${p.day || 1} of ${p.total_days || g.duration_days || '?'}`, PADX + areaW + 16, y + 54)
      // mini grid: last 14 non-future days
      const recent = (g.grid || []).filter(d => !d.is_future).slice(-14)
      const cell = 38, gap = 8
      recent.forEach((d, i) => {
        ctx.fillStyle = colorFor(d)
        roundRect(ctx, PADX + i * (cell + gap), y + 92, cell, cell, 6); ctx.fill()
      })
      // divider
      ctx.strokeStyle = '#1C1C1C'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PADX, y + rowH - 12); ctx.lineTo(S - PADX, y + rowH - 12); ctx.stroke()
      y += rowH
    })

    if (remaining > 0) {
      ctx.fillStyle = '#8A8A8A'; ctx.font = '700 26px -apple-system, Helvetica, sans-serif'
      ctx.fillText(`+${remaining} more goal${remaining > 1 ? 's' : ''}`, PADX, y + 4)
      y += 44
    }

    // ── bottom: total streak + projected outcome ──
    const by = Math.max(y + 20, 824)
    ctx.fillStyle = '#FF2D2D'; ctx.font = '800 86px -apple-system, Helvetica, sans-serif'
    ctx.fillText(String(totalStreak), PADX, by)
    const numW = ctx.measureText(String(totalStreak)).width
    ctx.fillStyle = '#8A8A8A'; ctx.font = '700 22px -apple-system, Helvetica, sans-serif'
    ctx.fillText('TOTAL DAY', PADX + numW + 22, by + 18)
    ctx.fillText('STREAK', PADX + numW + 22, by + 48)

    const proj = (primary.projected_outcome || '').trim()
    if (proj) {
      ctx.fillStyle = '#A8A8A8'; ctx.font = '500 25px -apple-system, Helvetica, sans-serif'
      wrap(ctx, proj, PADX, by + 116, S - PADX * 2, 34, 2)
    }

    // footer
    ctx.fillStyle = '#5C5C5C'; ctx.font = '600 24px -apple-system, Helvetica, sans-serif'
    const foot = (publicUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '') || 'strykdapp.com'
    ctx.fillText(foot, PADX, S - 50)

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
