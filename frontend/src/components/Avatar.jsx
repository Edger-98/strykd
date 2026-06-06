/**
 * Avatar with initials fallback. `src` is a data URL (base64) or http URL.
 * When no src is given, renders the user's initials on a deterministic
 * brand-tinted background.
 */
const PALETTE = ['#FF2D2D', '#0071E3', '#34C759', '#AF52DE', '#FF9500', '#FF2D55']

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function colorFor(name) {
  let h = 0
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function Avatar({ src, name, size = 40, fontSize, style = {}, border }) {
  const dim = { width: size, height: size, borderRadius: '50%', flexShrink: 0 }
  if (src) {
    return (
      <img src={src} alt={name || 'avatar'} style={{
        ...dim, objectFit: 'cover', border: border || 'none', ...style,
      }} />
    )
  }
  return (
    <div style={{
      ...dim, display: 'grid', placeItems: 'center', background: colorFor(name),
      color: '#fff', fontWeight: 700, fontSize: fontSize || size * 0.4,
      letterSpacing: '0.02em', border: border || 'none', ...style,
    }}>
      {initials(name)}
    </div>
  )
}
