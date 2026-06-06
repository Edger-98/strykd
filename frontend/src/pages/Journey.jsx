import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Menu, X, MapPin, Check, Sparkles, TrendingUp, Calendar, ChevronDown, Plus, Flame,
  Pause, Play, Eye, EyeOff, Loader2, Film,
} from 'lucide-react'
import DashSidebar, { SIDEBAR_W } from '../components/DashSidebar'
import AddGoalModal from '../components/AddGoalModal'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'

const LIFE_AREA_IMG = {
  career: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
  fitness: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1200&q=80',
  business: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&q=80',
  creative: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80',
  'personal-growth': 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80',
}
const imgFor = la => LIFE_AREA_IMG[(la || '').replace('_', '-')] || LIFE_AREA_IMG.career
const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function Journey() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [expanded, setExpanded] = useState({})  // goalId -> bool
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(() => {
    api.journey().then(d => {
      setData(d)
      setExpanded(prev => (Object.keys(prev).length ? prev : (d.goals[0] ? { [d.goals[0].id]: true } : {})))
    }).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else if (e.status === 402 || e.status === 404) { nav('/dashboard') }
      else setError(e.message)
    })
  }, [nav])

  useEffect(() => {
    if (!getToken()) { nav('/'); return }
    load()
  }, [load, nav])

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading your journey…</Centered>

  const { user, goals } = data

  return (
    <div style={S.shell}>
      <DashSidebar user={user} active="journey" navOpen={navOpen} setNavOpen={setNavOpen}
        onLogout={() => { clearToken(); nav('/') }} onAddGoal={() => setAddOpen(true)} />

      <motion.main className="dash-main" style={S.main} variants={pageVariants} initial="initial" animate="animate">
        <header style={S.header}>
          <button className="dash-menu-btn" style={S.icon} onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div style={{ flex: 1 }}>
            <p style={S.eyebrow}>YOUR JOURNEY</p>
            <h1 className="h-lg display" style={{ marginTop: 6 }}>The road{goals.length > 1 ? 's' : ''} to your goal{goals.length > 1 ? 's' : ''}</h1>
          </div>
          <button className="pill pill-red pill-sm" onClick={() => setAddOpen(true)} style={{ flexShrink: 0 }}>
            <Plus size={15} /> Add goal
          </button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {goals.map((g, i) => (
            <GoalCard key={g.id} goal={g} index={i} reload={load}
              expanded={!!expanded[g.id]} onToggle={() => setExpanded(e => ({ ...e, [g.id]: !e[g.id] }))}
              onPickDay={setSelectedDay} />
          ))}
        </div>
      </motion.main>

      <DayDrawer day={selectedDay} onClose={() => setSelectedDay(null)} />
      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  )
}

function GoalCard({ goal, index, expanded, onToggle, onPickDay, reload }) {
  const p = goal.progress
  const paused = goal.status === 'paused'
  const [busy, setBusy] = useState('')

  const update = async (field, body) => {
    setBusy(field)
    try { await api.updateGoal(goal.id, body); reload() }
    catch (e) { console.error(e); setBusy('') }
  }
  const togglePause = e => { e.stopPropagation(); update('pause', { status: paused ? 'active' : 'paused' }) }
  const togglePublic = e => { e.stopPropagation(); update('public', { page_public: !goal.page_public }) }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}
      style={{ ...S.goalCard, borderLeftColor: paused ? 'var(--d-text-muted)' : 'var(--red)', opacity: paused ? 0.82 : 1 }}>
      {/* header (always visible, click to expand) */}
      <button onClick={onToggle} style={S.goalHead}>
        <img src={imgFor(goal.life_area)} alt="" style={{ ...S.thumb, filter: paused ? 'grayscale(0.7)' : 'none' }} loading="lazy" />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={S.goalEyebrow}>
            {(goal.life_area || 'goal').replace('-', ' ').toUpperCase()}
            {paused && <span style={S.pausedBadge}><Pause size={9} /> PAUSED</span>}
          </p>
          <h2 className="display" style={S.goalTitle}>{goal.description}</h2>
          <p style={S.goalMeta}>
            Day {p.day} of {p.total_days}
            <span style={{ color: 'var(--d-text-muted)' }}> · </span>
            <Flame size={12} color="var(--red)" style={{ verticalAlign: -1 }} /> {goal.streak_days} day streak
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Arc pct={p.pct} size={64} stroke={5} fontSize="1.1rem" />
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ display: 'grid' }}><ChevronDown size={20} color="var(--d-text-dim)" /></motion.span>
        </div>
      </button>

      {/* controls */}
      <div style={S.goalControls}>
        <button onClick={togglePause} disabled={!!busy} style={S.ctrlBtn}>
          {busy === 'pause' ? <Loader2 size={13} className="spin-icon" /> : paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={togglePublic} disabled={!!busy} style={S.ctrlBtn}>
          {busy === 'public' ? <Loader2 size={13} className="spin-icon" /> : goal.page_public ? <Eye size={13} /> : <EyeOff size={13} />}
          {goal.page_public ? 'Public' : 'Private'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 4px 4px' }}>
              <ChapterMap weeks={goal.weeks} onPickDay={onPickDay} />
              <div style={S.projCard}>
                <p style={S.eyebrowRed}><Sparkles size={13} /> THE PAYOFF</p>
                <h3 className="display" style={{ fontSize: '1.15rem', margin: '8px 0 12px' }}>Your projected outcome if you show up every day</h3>
                <p style={{ color: 'var(--d-text-dim)', fontSize: '0.98rem', lineHeight: 1.65 }}>{goal.projected_outcome}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Arc({ pct, size = 140, stroke = 6, fontSize = '1.9rem' }) {
  const r = (size - stroke * 2) / 2, c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--d-line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--red)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ fontSize, fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
      </div>
    </div>
  )
}

function ChapterMap({ weeks, onPickDay }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h3 className="eyebrow" style={S.sectionTitle}>Chapter Map</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {weeks.map(w => (
          <div key={w.index} style={{ ...S.weekCard,
            border: w.status === 'current' ? '1.5px solid var(--red)' : '1px solid var(--d-line)',
            opacity: w.status === 'future' ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--d-text-muted)' }}>
                WEEK {String(w.index + 1).padStart(2, '0')}
              </span>
              {w.status === 'current' && <span style={S.hereBadge}><MapPin size={11} /> YOU ARE HERE</span>}
              {w.status === 'completed' && <span style={S.doneBadge}><Check size={11} /> {w.tasks_completed}/{w.tasks_total} DONE</span>}
            </div>
            <p className="display" style={{ fontSize: '1.1rem', marginTop: 6 }}>{w.title}</p>
            <div style={S.dayRow}>
              {w.days.map(d => (
                <button key={d.day_number} onClick={() => onPickDay(d)} title={`Day ${d.day_number}`}
                  className={d.is_today ? 'pulse-dot' : ''} style={{ ...S.dayCircle,
                    overflow: 'hidden',
                    background: d.completed ? 'var(--red)' : 'transparent',
                    borderColor: d.proof_url ? '#34C759' : d.is_today ? 'var(--red)' : d.completed ? 'var(--red)' : 'var(--d-line)' }}>
                  {d.proof_url && !d.is_video && (
                    <img src={d.proof_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {d.proof_url && d.is_video && <Film size={13} color="#34C759" />}
                  {!d.proof_url && d.completed && <Check size={12} color="#fff" strokeWidth={3} />}
                  {!d.proof_url && !d.completed && d.is_today && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}
                  <span style={S.dayNum}>{d.day_number}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DayDrawer({ day, onClose }) {
  return (
    <AnimatePresence>
      {day && (
        <>
          <motion.div onClick={onClose} style={S.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={S.drawer} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700, color: day.is_future ? 'var(--blue)' : 'var(--red)' }}>
                  {day.is_today ? 'TODAY' : day.is_future ? 'PLANNED' : 'PAST'}
                </p>
                <h2 className="display" style={{ fontSize: '1.4rem', marginTop: 4 }}>Day {day.day_number}</h2>
                <p style={{ color: 'var(--d-text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Calendar size={13} /> {fmtDate(day.date)}
                </p>
              </div>
              <button onClick={onClose} style={S.icon} aria-label="Close"><X size={18} /></button>
            </div>
            {day.proof_url && (
              <>
                <p style={S.drawerLabel}>Daily proof</p>
                <a href={day.proof_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                  {day.is_video
                    ? <video src={day.proof_url} style={S.drawerProof} controls />
                    : <img src={day.proof_url} alt="daily proof" style={S.drawerProof} />}
                </a>
              </>
            )}
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
                  <div style={{ fontSize: '0.74rem', color: 'var(--d-text-muted)', marginBottom: 6 }}>{day.signal.tasks_completed}/{day.signal.tasks_total} tasks</div>
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
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '40px clamp(20px, 5vw, 56px)', maxWidth: 900, width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  eyebrow: { color: 'var(--d-text-muted)', fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 },
  eyebrowRed: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--d-line)' },

  goalCard: { background: 'var(--d-card)', borderRadius: 18, border: '1px solid var(--d-line)', borderLeft: '3px solid var(--red)', overflow: 'hidden' },
  pausedBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--d-text-muted)', border: '1px solid var(--d-text-muted)', borderRadius: 50, padding: '2px 7px', verticalAlign: 1 },
  goalControls: { display: 'flex', gap: 10, padding: '0 18px 16px', flexWrap: 'wrap' },
  ctrlBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, background: 'var(--d-bg)', border: '1px solid var(--d-line)', color: 'var(--d-text-dim)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' },
  goalHead: { display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: 'transparent', border: 'none', padding: 18, cursor: 'pointer', color: 'var(--d-text)' },
  thumb: { width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0 },
  goalEyebrow: { fontSize: '0.66rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--red)' },
  goalTitle: { fontSize: '1.15rem', margin: '4px 0 6px', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  goalMeta: { fontSize: '0.82rem', color: 'var(--d-text-dim)' },
  projCard: { background: 'linear-gradient(135deg, var(--d-bg), #1a0d0d)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24, marginTop: 20 },

  weekCard: { background: 'var(--d-bg)', borderRadius: 14, padding: 18 },
  hereBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 50, padding: '3px 9px' },
  doneBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: '#34C759', border: '1px solid #34C759', borderRadius: 50, padding: '3px 9px' },
  dayRow: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  dayCircle: { position: 'relative', width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--d-line)', display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'transparent' },
  dayNum: { position: 'absolute', bottom: -17, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', color: 'var(--d-text-muted)' },

  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', zIndex: 60 },
  drawer: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 61, background: 'var(--d-panel)', borderLeft: '1px solid var(--d-line)', padding: 28, overflowY: 'auto', color: 'var(--d-text)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' },
  drawerLabel: { fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--d-text-muted)', textTransform: 'uppercase', margin: '24px 0 12px' },
  drawerTask: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--d-card)', borderRadius: 12 },
  drawerSignal: { padding: '16px 18px', background: 'var(--d-card)', borderRadius: 12, borderLeft: '3px solid var(--red)' },
  drawerProof: { width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--d-line)', display: 'block' },
}
