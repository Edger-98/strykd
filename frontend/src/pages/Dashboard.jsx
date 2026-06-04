import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Checklist from '../components/Checklist'
import ReplanPanel from '../components/ReplanPanel'
import SignalWall from '../components/SignalWall'
import ThemeWrapper from '../components/ThemeWrapper'
import { api, clearToken, getToken } from '../api'

export default function Dashboard() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.dashboard().then(setData).catch(e => {
      if (e.status === 401 || e.status === 403) {
        clearToken()
        nav('/')
      } else {
        setError(e.message)
      }
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

  const logout = () => { clearToken(); nav('/') }

  if (error) {
    return <Centered>{error}</Centered>
  }
  if (!data) {
    return <Centered>Loading your dashboard…</Centered>
  }

  const { user, theme, goals, today_tasks, signal_wall } = data
  const goalId = goals?.[0]?.id
  const taskDate = today_tasks?.[0]?.task_date || new Date().toISOString().slice(0, 10)
  const doneCount = today_tasks.filter(t => t.completed).length

  return (
    <ThemeWrapper theme={theme}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 600 }}>
            STRYKD
          </span>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href={`/${user.slug}`} target="_blank" rel="noreferrer"
               style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>
              View public page ↗
            </a>
            <button onClick={logout} style={{
              fontSize: '0.8rem', color: 'var(--fg-dim)', background: 'none',
              border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.7rem',
            }}>Log out</button>
          </div>
        </div>

        {/* Greeting + streak */}
        <header style={{ marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--fw-display)',
            letterSpacing: 'var(--ls-display)',
            fontSize: 'clamp(1.8rem, 6vw, 2.6rem)',
            marginBottom: '0.75rem',
          }}>
            Hello, {user.name.split(' ')[0]}
          </h1>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🔥 {user.streak_days} day streak</span>
            <span style={{ color: 'var(--fg-dim)', fontSize: '0.9rem' }}>
              {doneCount}/{today_tasks.length} done today
            </span>
          </div>
          {theme?.daily_headline && (
            <p style={{ color: 'var(--fg-dim)', marginTop: '1rem', fontSize: '1rem' }}>
              {theme.daily_headline}
            </p>
          )}
        </header>

        {/* Today's checklist */}
        <section style={{ marginBottom: '2rem' }}>
          <SectionTitle>Today's Tasks</SectionTitle>
          <Checklist tasks={today_tasks} onUpdate={onTaskComplete} />
          {goalId && (
            <ReplanPanel goalId={goalId} taskDate={taskDate} onConfirmed={load} />
          )}
        </section>

        {/* Signal Wall */}
        <section style={{ marginTop: '3rem' }}>
          <SectionTitle>Signal Wall</SectionTitle>
          <SignalWall entries={signal_wall} />
        </section>
      </div>
    </ThemeWrapper>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: '0.8rem', letterSpacing: '0.15em', color: 'var(--fg-muted)',
      fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem',
      paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)',
    }}>{children}</h2>
  )
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <p style={{ color: 'var(--fg-dim)' }}>{children}</p>
    </div>
  )
}
