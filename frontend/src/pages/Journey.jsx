import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Menu, X, MapPin, Check, Sparkles, TrendingUp, Calendar, Target,
} from 'lucide-react'
import DashSidebar, { SIDEBAR_W } from '../components/DashSidebar'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'

const LIFE_AREA_IMG = {
  career: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
  fitness: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1200&q=80',
  business: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&q=80',
  creative: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80',
  'personal-growth': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80',
}
const imgFor = la => {
  const k = (la || '').replace('_', '-')
  return LIFE_AREA_IMG[k] || LIFE_AREA_IMG.career
}
const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function Journey() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  const load = useCallback(() => {
    api.journey().then(setData).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else if (e.status === 402) { nav('/dashboard') }      // trial locked -> upgrade prompt lives on /dashboard
      else if (e.status === 404) { nav('/dashboard') }       // no journey yet
      else setError(e.message)
    })
  }, [nav])

  useEffect(() => {
    if (!getToken()) { nav('/'); return }
    load()
  }, [load, nav])

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading your journey…</Centered>

  const { user, goal, theme, progress, projected_outcome, weeks } = data

  return (
    <div style={S.shell}>
      <DashSidebar user={user} active="journey" navOpen={navOpen} setNavOpen={setNavOpen}
        onLogout={() => { clearToken(); nav('/') }} />

      <motion.main className="dash-main" style={S.main} variants={pageVariants} initial="initial" animate="animate">
        <header style={S.header}>
          <button className="dash-menu-btn" style={S.icon} onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div>
            <p style={S.eyebrow}>YOUR JOURNEY</p>
            <h1 className="h-lg display" style={{ marginTop: 6 }}>The road to your goal</h1>
          </div>
        </header>

        <OutcomeCard goal={goal} theme={theme} progress={progress} />

        <ChapterMap weeks={weeks} onPickDay={setSelectedDay} />

        <ProjectionCard text={projected_outcome || theme.mission_statement} />
      </motion.main>

      <DayDrawer day={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  )
}

/* ── Top projected-outcome / progress card ── */
function OutcomeCard({ goal, theme, progress }) {
  return (
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={S.outcomeCard}>
      <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
        <img src={imgFor(goal.life_area)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,17,17,0) 40%, var(--d-card) 100%)' }} />
      </div>

      <div style={S.outcomeBody}>
        <div style={{ flex: '1 1 320px' }}>
          <p style={S.eyebrowRed}><Target size={13} /> THE OBJECTIVE</p>
          <h2 className="display" style={{ fontSize: '1.5rem', lineHeight: 1.25, margin: '10px 0 12px' }}>{goal.description}</h2>
          {theme.mission_statement && (
            <p style={{ color: 'var(--d-text-dim)', fontSize: '0.95rem', lineHeight: 1.55 }}>{theme.mission_statement}</p>
          )}
          <div style={S.dayStat}>
            Day <span style={{ color: 'var(--red)' }}>{progress.day}</span> of {progress.total_days}
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
          <Arc pct={progress.pct} />
          <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--d-text-muted)', letterSpacing: '0.1em', fontWeight: 700 }}>
            {progress.tasks_completed}/{progress.tasks_total} TASKS
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Arc({ pct }) {
  const r = 56, c = 2 * Math.PI * r, size = 140
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-line)" strokeWidth={6} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--red)" strokeWidth={6} strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--d-text-muted)', letterSpacing: '0.1em', fontWeight: 700 }}>COMPLETE</div>
        </div>
      </div>
    </div>
  )
}

/* ── Chapter map ── */
function ChapterMap({ weeks, onPickDay }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2 className="eyebrow" style={S.sectionTitle}>Chapter Map</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {weeks.map((w, i) => (
          <motion.div key={w.index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, delay: i * 0.05 }}
            style={{ ...S.weekCard,
              border: w.status === 'current' ? '1.5px solid var(--red)' : '1px solid var(--d-line)',
              opacity: w.status === 'future' ? 0.5 : 1 }}>
            <div style={S.weekHead}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--d-text-muted)' }}>
                    WEEK {String(w.index + 1).padStart(2, '0')}
                  </span>
                  {w.status === 'current' && (
                    <span style={S.hereBadge}><MapPin size={11} /> YOU ARE HERE</span>
                  )}
                  {w.status === 'completed' && (
                    <span style={S.doneBadge}><Check size={11} /> {w.tasks_completed}/{w.tasks_total} DONE</span>
                  )}
                </div>
                <p className="display" style={{ fontSize: '1.15rem', marginTop: 6, letterSpacing: '-0.01em' }}>{w.title}</p>
              </div>
            </div>

            <div style={S.dayRow}>
              {w.days.map(d => (
                <button key={d.day_number} onClick={() => onPickDay(d)} title={`Day ${d.day_number}`}
                  className={d.is_today ? 'pulse-dot' : ''} style={{ ...S.dayCircle,
                    background: d.completed ? 'var(--red)' : 'transparent',
                    borderColor: d.is_today ? 'var(--red)' : d.completed ? 'var(--red)' : 'var(--d-line)' }}>
                  {d.completed && <Check size={12} color="#fff" strokeWidth={3} />}
                  {!d.completed && d.is_today && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}
                  <span style={S.dayNum}>{d.day_number}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ── Bottom projected outcome card ── */
function ProjectionCard({ text }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }} style={S.projCard}>
      <p style={S.eyebrowRed}><Sparkles size={13} /> THE PAYOFF</p>
      <h3 className="display" style={{ fontSize: '1.3rem', margin: '10px 0 14px' }}>Your projected outcome if you show up every day</h3>
      <p style={{ color: 'var(--d-text-dim)', fontSize: '1.02rem', lineHeight: 1.65 }}>{text}</p>
    </motion.div>
  )
}

/* ── Day detail drawer ── */
function DayDrawer({ day, onClose }) {
  return (
    <AnimatePresence>
      {day && (
        <>
          <motion.div onClick={onClose} style={S.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={S.drawer} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700,
                  color: day.is_future ? 'var(--blue)' : 'var(--red)' }}>
                  {day.is_today ? 'TODAY' : day.is_future ? 'PLANNED' : 'PAST'}
                </p>
                <h2 className="display" style={{ fontSize: '1.4rem', marginTop: 4 }}>Day {day.day_number}</h2>
                <p style={{ color: 'var(--d-text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={13} /> {fmtDate(day.date)}
                </p>
              </div>
              <button onClick={onClose} style={S.icon} aria-label="Close"><X size={18} /></button>
            </div>

            <p style={S.drawerLabel}>{day.is_future ? "What's planned" : 'Your tasks'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {day.tasks.length ? day.tasks.map((t, i) => (
                <div key={i} style={S.drawerTask}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center',
                    border: `2px solid ${t.completed ? 'var(--red)' : 'var(--d-line)'}`, background: t.completed ? 'var(--red)' : 'transparent' }}>
                    {t.completed && <Check size={11} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1.45, color: t.completed ? 'var(--d-text-muted)' : 'var(--d-text)',
                    textDecoration: t.completed ? 'line-through' : 'none' }}>{t.content}</span>
                </div>
              )) : <p style={{ color: 'var(--d-text-muted)', fontSize: '0.9rem' }}>No tasks for this day.</p>}
            </div>

            {day.signal && (
              <>
                <p style={{ ...S.drawerLabel, marginTop: 28 }}><TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Signal wall</p>
                <div style={S.drawerSignal}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--d-text-muted)', marginBottom: 6 }}>
                    {day.signal.tasks_completed}/{day.signal.tasks_total} tasks
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{day.signal.ai_summary}</p>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Centered({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--d-panel)', color: 'var(--d-text-dim)' }}><p>{children}</p></div>
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--d-panel)', display: 'flex', color: 'var(--d-text)' },
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '40px clamp(20px, 5vw, 56px)', maxWidth: 880, width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 },
  eyebrow: { color: 'var(--d-text-muted)', fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 },
  eyebrowRed: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--d-line)' },

  outcomeCard: { background: 'var(--d-card)', borderRadius: 18, borderLeft: '3px solid var(--red)', overflow: 'hidden' },
  outcomeBody: { display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center', padding: '8px 28px 28px' },
  dayStat: { marginTop: 18, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.01em' },

  weekCard: { background: 'var(--d-card)', borderRadius: 16, padding: 22 },
  weekHead: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  hereBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 50, padding: '3px 9px' },
  doneBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
    color: '#34C759', border: '1px solid #34C759', borderRadius: 50, padding: '3px 9px' },
  dayRow: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  dayCircle: { position: 'relative', width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--d-line)',
    display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'transparent', transition: 'transform 0.15s var(--ease)' },
  dayNum: { position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.62rem', color: 'var(--d-text-muted)' },

  projCard: { background: 'linear-gradient(135deg, var(--d-card), #1a0d0d)', border: '1px solid var(--d-line)', borderRadius: 18, padding: 32, marginTop: 48, marginBottom: 8 },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', zIndex: 60 },
  drawer: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 61, background: 'var(--d-panel)',
    borderLeft: '1px solid var(--d-line)', padding: 28, overflowY: 'auto', color: 'var(--d-text)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' },
  drawerLabel: { fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--d-text-muted)', textTransform: 'uppercase', margin: '24px 0 12px' },
  drawerTask: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--d-card)', borderRadius: 12 },
  drawerSignal: { padding: '16px 18px', background: 'var(--d-card)', borderRadius: 12, borderLeft: '3px solid var(--red)' },
}
