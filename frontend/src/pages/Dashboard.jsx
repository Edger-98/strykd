import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Flame, Radio, ExternalLink, LogOut, Target, Menu, X,
} from 'lucide-react'
import Checklist from '../components/Checklist'
import ReplanPanel from '../components/ReplanPanel'
import SignalWall from '../components/SignalWall'
import { useCountUp } from '../hooks'
import { api, clearToken, getToken } from '../api'

export default function Dashboard() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('today') // 'today' | 'signal'
  const [navOpen, setNavOpen] = useState(false)

  const load = useCallback(() => {
    api.dashboard().then(setData).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else setError(e.message)
    })
  }, [nav])

  useEffect(() => {
    if (!getToken()) { nav('/'); return }
    load()
  }, [load, nav])

  const onTaskComplete = (taskId, newStreak) => {
    setData(d => ({
      ...d,
      user: { ...d.user, streak_days: newStreak },
      today_tasks: d.today_tasks.map(t => t.id === taskId ? { ...t, completed: true } : t),
    }))
  }

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading…</Centered>

  const { user, goals, today_tasks, signal_wall } = data
  const goalId = goals?.[0]?.id
  const taskDate = today_tasks?.[0]?.task_date || new Date().toISOString().slice(0, 10)
  const done = today_tasks.filter(t => t.completed).length
  const total = today_tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={S.shell}>
      {/* ── Sidebar (Linear-style) ── */}
      <aside className={`dash-sidebar${navOpen ? ' open' : ''}`} style={S.sidebar}>
        <div style={S.sideTop}>
          <span style={S.brand}>STRYKD</span>
          <button style={S.iconBtn} onClick={() => setNavOpen(false)}><X size={18} /></button>
        </div>

        <nav style={S.navList}>
          <NavItem active={tab === 'today'} Icon={LayoutGrid} label="Today" onClick={() => { setTab('today'); setNavOpen(false) }} />
          <NavItem active={tab === 'signal'} Icon={Radio} label="Signal Wall" onClick={() => { setTab('signal'); setNavOpen(false) }} />
          {user.page_public !== false && (
            <a href={`/${user.slug}`} target="_blank" rel="noreferrer" style={S.navItem}>
              <ExternalLink size={18} /> <span>Public page</span>
            </a>
          )}
        </nav>

        {/* Streak (neon blue) */}
        <div style={{ marginTop: 'auto' }}>
          <StreakBadge streak={user.streak_days} />
          <button style={S.logout} onClick={() => { clearToken(); nav('/') }}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      {navOpen && <div style={S.overlay} onClick={() => setNavOpen(false)} />}

      {/* ── Main ── */}
      <main className="dash-main" style={S.main}>
        <header style={S.mainHeader}>
          <button className="dash-menu-btn" style={S.iconBtn} onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <div className="anim-up">
            <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="display h-lg">Hello, {user.name.split(' ')[0]}</h1>
          </div>
        </header>

        {tab === 'today' ? (
          <div className="anim-up d1">
            {/* progress */}
            <div style={S.progressRow}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <Target size={18} color="var(--text-muted)" />
                <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{done}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{total}</span></span>
                <span style={{ color: pct === 100 ? 'var(--blue)' : 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {pct === 100 ? 'complete' : `${pct}% done`}
                </span>
              </div>
            </div>
            <div style={S.bar}>
              <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', borderRadius: 5 }} />
            </div>

            <h2 className="eyebrow" style={S.sectionTitle}>Today's Tasks</h2>
            <Checklist tasks={today_tasks} onUpdate={onTaskComplete} />
            {goalId && <ReplanPanel goalId={goalId} taskDate={taskDate} onConfirmed={load} />}
          </div>
        ) : (
          <div className="anim-up d1">
            <h2 className="eyebrow" style={S.sectionTitle}>Signal Wall</h2>
            <SignalWall entries={signal_wall} />
          </div>
        )}
      </main>
    </div>
  )
}

function NavItem({ active, Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}>
      <Icon size={18} color={active ? 'var(--red)' : 'var(--text-dim)'} /> <span>{label}</span>
    </button>
  )
}

function StreakBadge({ streak }) {
  const n = useCountUp(streak)
  return (
    <div style={S.streakCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Flame size={20} color="var(--blue)" />
        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--blue)', lineHeight: 1 }}>{n}</span>
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 700, marginTop: '0.4rem', display: 'block' }}>
        DAY STREAK
      </span>
    </div>
  )
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--black)' }}>
      <p className="anim-fade" style={{ color: 'var(--text-dim)' }}>{children}</p>
    </div>
  )
}

const SIDEBAR_W = 248
const S = {
  shell: { minHeight: '100vh', background: 'var(--black)', display: 'flex' },
  sidebar: {
    width: SIDEBAR_W, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--line)',
    display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', position: 'fixed', top: 0, bottom: 0, left: 0,
    transition: 'transform 0.25s var(--ease-out)', zIndex: 30,
  },
  sideTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem', marginBottom: '2rem' },
  brand: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1rem' },
  navList: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.75rem',
    background: 'transparent', border: 'none', borderRadius: 10, color: 'var(--text-dim)',
    fontSize: '0.92rem', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s var(--ease-out)',
  },
  navItemActive: { background: 'var(--surface-2)', color: 'var(--white)' },
  streakCard: { background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem' },
  logout: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.75rem', width: '100%',
    background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, borderRadius: 10,
  },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20 },
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '2.5rem clamp(1.25rem, 5vw, 3rem)', maxWidth: 820, width: '100%' },
  mainHeader: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' },
  iconBtn: { background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
  progressRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  bar: { height: 8, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden', marginBottom: '2.5rem' },
  sectionTitle: { marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--line)' },
}
