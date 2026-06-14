import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Flame, Trophy, Sparkles } from 'lucide-react'

/**
 * Full-screen celebration moment. Fires confetti, shows the milestone, and
 * auto-dismisses after ~2.6s. `data` shape:
 *   { type: 'day' | 'streak' | 'chapter', title, streak, message }
 */
const ICONS = { day: Sparkles, streak: Flame, chapter: Trophy }

function burst(type) {
  const base = { spread: 80, startVelocity: 45, ticks: 220, zIndex: 9999 }
  const colors = ['#FF2D2D', '#FF7A3D', '#FFD23D', '#ffffff']
  confetti({ ...base, particleCount: 90, origin: { x: 0.2, y: 0.7 }, angle: 60, colors })
  confetti({ ...base, particleCount: 90, origin: { x: 0.8, y: 0.7 }, angle: 120, colors })
  if (type !== 'day') {
    // Extra pop for milestone moments (streak badge / chapter complete)
    setTimeout(() => confetti({ ...base, particleCount: 120, origin: { x: 0.5, y: 0.4 }, spread: 360, startVelocity: 32, colors }), 250)
  }
}

export default function Celebration({ data, onDone }) {
  useEffect(() => {
    if (!data) return
    burst(data.type)
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [data, onDone])

  const Icon = ICONS[data?.type] || Sparkles
  const isMilestone = data && data.type !== 'day'

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }} style={S.shell} onClick={onDone}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            style={S.card}
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 14 }}
              style={{ ...S.badge, background: isMilestone ? 'rgba(255,45,45,0.14)' : 'rgba(255,255,255,0.06)' }}
            >
              <Icon size={isMilestone ? 46 : 40} color={isMilestone ? 'var(--red)' : '#fff'} />
            </motion.div>

            <h1 style={S.title}>{data.title}</h1>
            {data.streak > 0 && (
              <div style={S.streak}>
                <Flame size={18} color="var(--red)" />
                <span><strong>{data.streak}</strong> day streak</span>
              </div>
            )}
            {data.message && <p style={S.msg}>{data.message}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const S = {
  shell: { position: 'fixed', inset: 0, zIndex: 9000, display: 'grid', placeItems: 'center',
    background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', padding: 24, cursor: 'pointer' },
  card: { textAlign: 'center', color: '#fff', maxWidth: 420 },
  badge: { width: 100, height: 100, borderRadius: 32, display: 'grid', placeItems: 'center', margin: '0 auto 24px' },
  title: { fontSize: 'clamp(2rem, 7vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.05 },
  streak: { display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '8px 18px',
    borderRadius: 50, background: 'rgba(255,45,45,0.12)', border: '1px solid rgba(255,45,45,0.4)', fontSize: '1rem' },
  msg: { color: '#C9C9C9', fontSize: '1.05rem', lineHeight: 1.55, marginTop: 20 },
}
