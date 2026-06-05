import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flame, ArrowDown, Check, Link2, Share2 } from 'lucide-react'
import SignalWall from '../components/SignalWall'
import { inView, revealVariants } from '../motion'
import { api } from '../api'

const THEMES = {
  'dark-ember':   { bg: '#1A0E08', surface: '#241409', fg: '#F5EDE6', dim: '#B89B86', accent: '#FF5A1F', onLight: '#1A0E08' },
  'arctic-focus': { bg: '#0B1B2B', surface: '#12283D', fg: '#EAF4FF', dim: '#9DB6CC', accent: '#0071E3', onLight: '#0B1B2B' },
  'soft-earth':   { bg: '#2B2117', surface: '#3A2D20', fg: '#F3ECE1', dim: '#C4B09A', accent: '#C2714F', onLight: '#3A2D20' },
}

export default function PublicPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.publicPage(slug).then(setData).catch(() => setError('This page does not exist.'))
  }, [slug])

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (error) return <Splash>{error}</Splash>
  if (!data) return <SkeletonPage />

  const { user, theme, goals, today_tasks, signal_wall } = data
  const t = THEMES[theme?.color_palette] || THEMES['arctic-focus']
  const goal = goals?.[0]
  const { pct, dayNum, totalDays, currentWeek } = computeProgress(goal)

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* ── Cinematic themed hero ── */}
      <section style={{ ...S.hero, background: t.bg, color: t.fg }}>
        <div style={S.heroInner}>
          <motion.div style={S.heroTop} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span style={{ letterSpacing: '0.2em', fontWeight: 800, fontSize: '0.85rem' }}>STRYKD</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.accent, fontWeight: 700, fontSize: '0.8rem' }}>
              <Flame size={14} color={t.accent} /> {user.streak_days} DAY STREAK
            </span>
          </motion.div>

          <div style={S.heroBody}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <motion.p style={{ ...S.eyebrowT, color: t.dim }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                {user.name}{dayNum != null ? ` · Day ${dayNum} of ${totalDays}` : ''}
              </motion.p>
              {theme?.mission_statement && (
                <motion.h1 className="display" style={S.mission}
                  initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  {firstSentence(theme.mission_statement)}
                </motion.h1>
              )}
              {theme?.daily_headline && (
                <motion.p style={{ ...S.headline, color: t.accent }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  {theme.daily_headline}
                </motion.p>
              )}
            </div>
            {pct != null && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.4 }}>
                <ProgressArc pct={pct} accent={t.accent} track={t.surface} fg={t.fg} dim={t.dim} />
              </motion.div>
            )}
          </div>

          <motion.div style={{ ...S.scroll, color: t.dim }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <ArrowDown size={16} /> SCROLL
          </motion.div>
        </div>
      </section>

      {/* ── Content (editorial, light) ── */}
      <div className="container-narrow" style={{ padding: '0 24px 100px' }}>
        {/* Commitment */}
        {goal && (
          <Reveal><section style={{ marginTop: 80 }}>
            <Eyebrow>The Commitment</Eyebrow>
            <div className="card" style={{ padding: 32 }}>
              <p style={{ fontSize: '1.3rem', lineHeight: 1.4, fontWeight: 600, marginBottom: 14 }}>{goal.description}</p>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-light)', letterSpacing: '0.06em', fontWeight: 600 }}>
                {goal.duration_days} DAYS · {goal.start_date} → {goal.end_date}
              </span>
            </div>
          </section></Reveal>
        )}

        {/* Chapter timeline */}
        {theme?.chapter_titles?.length > 0 && (
          <Reveal><section style={{ marginTop: 80 }}>
            <Eyebrow>The Arc</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {theme.chapter_titles.map((title, i) => {
                const isCurrent = i === currentWeek
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="card" style={{ padding: 24, position: 'relative', overflow: 'hidden',
                      background: isCurrent ? t.bg : '#fff', color: isCurrent ? t.fg : 'var(--ink)',
                      boxShadow: isCurrent ? '0 12px 40px rgba(0,0,0,0.18)' : 'var(--shadow-card)' }}>
                    <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 700,
                      color: isCurrent ? t.accent : 'var(--gray-light)' }}>
                      WEEK {String(i + 1).padStart(2, '0')}{isCurrent ? ' · NOW' : ''}
                    </span>
                    <p className="display" style={{ fontSize: '1.25rem', marginTop: 8, letterSpacing: '-0.02em' }}>{title}</p>
                  </motion.div>
                )
              })}
            </div>
          </section></Reveal>
        )}

        {/* Today */}
        <Reveal><section style={{ marginTop: 80 }}>
          <Eyebrow>Today</Eyebrow>
          <div className="card" style={{ padding: '12px 28px' }}>
            {today_tasks?.length > 0 ? today_tasks.map((task, i) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0',
                borderBottom: i < today_tasks.length - 1 ? '1px solid var(--gray-line)' : 'none', opacity: task.completed ? 0.5 : 1 }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center',
                  border: `2px solid ${task.completed ? t.accent : 'var(--gray-line)'}`, background: task.completed ? t.accent : 'transparent' }}>
                  {task.completed && <Check size={13} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ fontSize: '0.97rem', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.content}</span>
              </div>
            )) : <p style={{ color: 'var(--gray-light)', padding: '16px 0' }}>No tasks scheduled today.</p>}
          </div>
        </section></Reveal>

        {/* Signal Wall */}
        <Reveal><section style={{ marginTop: 80 }}>
          <Eyebrow>Signal Wall</Eyebrow>
          <SignalWall entries={signal_wall} />
        </section></Reveal>

        {/* Share */}
        <div style={{ marginTop: 64, textAlign: 'center' }}>
          <button className="pill pill-dark pill-lg" onClick={share}>
            {copied ? <><Check size={18} /> Copied!</> : <><Link2 size={18} /> Share my page</>}
          </button>
        </div>

        {/* Powered by */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <span style={S.poweredBadge}>
            <Share2 size={13} /> Powered by <strong style={{ marginLeft: 3 }}>Strykd</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

function ProgressArc({ pct, accent, track, fg, dim }) {
  const r = 70, c = 2 * Math.PI * r, size = 180
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={12} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: fg, lineHeight: 1 }}>{Math.round(pct)}%</div>
          <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: dim, fontWeight: 600, marginTop: 4 }}>OF GOAL</div>
        </div>
      </div>
    </div>
  )
}

function Reveal({ children }) {
  return <motion.div variants={revealVariants} initial="hidden" whileInView="show" viewport={inView}>{children}</motion.div>
}
function Eyebrow({ children }) {
  return <h2 className="eyebrow" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--gray-line)' }}>{children}</h2>
}

function firstSentence(text) {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}
function computeProgress(goal) {
  if (!goal) return {}
  const start = new Date(goal.start_date + 'T00:00:00')
  const total = goal.duration_days || 1
  const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000)
  const dayNum = Math.min(Math.max(elapsed + 1, 1), total)
  const pct = Math.min(Math.max((elapsed / total) * 100, 0), 100)
  const currentWeek = Math.min(Math.floor(elapsed / 7), Math.ceil(total / 7) - 1)
  return { pct, dayNum, totalDays: total, currentWeek }
}

function Splash({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}><p style={{ color: 'var(--gray-text)' }}>{children}</p></div>
}
function SkeletonPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0B1B2B', padding: '80px 24px' }}>
      <div className="container-narrow">
        <div className="skeleton" style={{ height: 18, width: 120, marginBottom: 30, opacity: 0.2 }} />
        <div className="skeleton" style={{ height: 70, width: '80%', marginBottom: 14, opacity: 0.2 }} />
        <div className="skeleton" style={{ height: 70, width: '55%', opacity: 0.2 }} />
      </div>
    </div>
  )
}

const S = {
  hero: { minHeight: '100vh', display: 'flex', alignItems: 'center' },
  heroInner: { width: '100%', maxWidth: 980, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', minHeight: '88vh', justifyContent: 'space-between' },
  heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20 },
  heroBody: { display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', flex: 1, padding: '40px 0' },
  eyebrowT: { fontSize: '0.85rem', letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 20 },
  mission: { fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 1.05 },
  headline: { fontSize: 'clamp(1.05rem, 2vw, 1.4rem)', fontWeight: 600, marginTop: 24, maxWidth: 560 },
  scroll: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', letterSpacing: '0.15em', fontWeight: 600, paddingBottom: 10 },
  poweredBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 50,
    background: 'var(--gray-section)', color: 'var(--gray-text)', fontSize: '0.82rem' },
}
