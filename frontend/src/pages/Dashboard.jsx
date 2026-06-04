import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Checklist from '../components/Checklist'
import ReplanPanel from '../components/ReplanPanel'
import SignalWall from '../components/SignalWall'
import ThemeWrapper from '../components/ThemeWrapper'
import { useCountUp } from '../hooks'
import { api, clearToken, getToken } from '../api'

export default function Dashboard() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

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
  if (!data) return <Centered>Loading your dashboard…</Centered>

  const { user, theme, goals, today_tasks, signal_wall } = data
  const goalId = goals?.[0]?.id
  const taskDate = today_tasks?.[0]?.task_date || new Date().toISOString().slice(0, 10)
  const done = today_tasks.filter(t => t.completed).length
  const total = today_tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <ThemeWrapper theme={theme}>
      <div className="page-enter" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
        {/* Top bar */}
        <div className="anim-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '0.82rem', letterSpacing: '0.18em', color: 'var(--fg-muted)', fontWeight: 700 }}>
            STRYKD
          </span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {user.page_public !== false && (
              <a href={`/${user.slug}`} target="_blank" rel="noreferrer"
                 style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                View public page ↗
              </a>
            )}
            <button onClick={() => { clearToken(); nav('/') }} style={{
              fontSize: '0.8rem', color: 'var(--fg-dim)', background: 'none',
              border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem 0.75rem',
            }}>Log out</button>
          </div>
        </div>

        {/* Hero stats */}
        <header className="anim-up d1" style={{ marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-display)',
            letterSpacing: 'var(--ls-display)', fontSize: 'clamp(2rem, 7vw, 3rem)', marginBottom: '1.5rem',
          }}>
            Hello, {user.name.split(' ')[0]}
          </h1>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <StreakCard streak={user.streak_days} />
            <ProgressCard done={done} total={total} pct={pct} />
          </div>

          {theme?.daily_headline && (
            <p className="anim-up d3" style={{ color: 'var(--fg-dim)', marginTop: '1.5rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
              {theme.daily_headline}
            </p>
          )}
        </header>

        {/* Checklist */}
        <section className="anim-up d3" style={{ marginBottom: '2rem' }}>
          <Eyebrow>Today's Tasks</Eyebrow>
          <Checklist tasks={today_tasks} onUpdate={onTaskComplete} />
          {goalId && <ReplanPanel goalId={goalId} taskDate={taskDate} onConfirmed={load} />}
        </section>

        {/* Signal Wall */}
        <section className="anim-up d4" style={{ marginTop: '3rem' }}>
          <Eyebrow>Signal Wall</Eyebrow>
          <SignalWall entries={signal_wall} />
        </section>
      </div>
    </ThemeWrapper>
  )
}

function StreakCard({ streak }) {
  const n = useCountUp(streak)
  return (
    <div className="card" style={{ flex: 1, minWidth: 140, padding: '1.25rem' }}>
      <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
        🔥 {n}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', letterSpacing: '0.08em', marginTop: '0.5rem' }}>
        DAY STREAK
      </div>
    </div>
  )
}

function ProgressCard({ done, total, pct }) {
  return (
    <div className="card" style={{ flex: 2, minWidth: 180, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{done}<span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>/{total}</span></span>
        <span style={{ fontSize: '0.82rem', color: pct === 100 ? 'var(--accent)' : 'var(--fg-dim)', fontWeight: 600 }}>
          {pct}% {pct === 100 ? '· complete' : 'done today'}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-hover)', borderRadius: 5, overflow: 'hidden' }}>
        <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 5 }} />
      </div>
    </div>
  )
}

function Eyebrow({ children }) {
  return (
    <h2 style={{
      fontSize: '0.78rem', letterSpacing: '0.18em', color: 'var(--fg-muted)', fontWeight: 700,
      textTransform: 'uppercase', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)',
    }}>{children}</h2>
  )
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg, #0D0805)' }}>
      <p className="anim-fade" style={{ color: 'var(--fg-dim, #A89080)' }}>{children}</p>
    </div>
  )
}
