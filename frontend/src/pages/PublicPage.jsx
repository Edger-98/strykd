import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignalWall from '../components/SignalWall'
import ThemeWrapper from '../components/ThemeWrapper'
import { api } from '../api'

export default function PublicPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.publicPage(slug)
      .then(setData)
      .catch(() => setError('This page does not exist.'))
  }, [slug])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--fg-dim)' }}>{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--fg-dim)' }}>Loading…</p>
      </div>
    )
  }

  const { user, theme, goals, today_tasks, signal_wall } = data

  return (
    <ThemeWrapper theme={theme}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 5rem' }}>
        {/* Header */}
        <header style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', letterSpacing: '0.15em', color: 'var(--fg-muted)', fontWeight: 600 }}>
              STRYKD
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>
              🔥 {user.streak_days} day streak
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--fw-display)',
            letterSpacing: 'var(--ls-display)',
            lineHeight: 'var(--lh-display)',
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            textTransform: theme?.typography_variant === 'bold-condensed' ? 'uppercase' : 'none',
            marginBottom: '1rem',
          }}>
            {user.name}
          </h1>

          {theme?.daily_headline && (
            <p style={{ color: 'var(--accent)', fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' }}>
              {theme.daily_headline}
            </p>
          )}

          {theme?.mission_statement && (
            <p style={{ color: 'var(--fg-dim)', fontSize: '1.1rem', lineHeight: 1.6, fontStyle: theme?.typography_variant === 'editorial' ? 'italic' : 'normal' }}>
              {theme.mission_statement}
            </p>
          )}
        </header>

        {/* Goals */}
        {goals?.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            {goals.map(g => (
              <div key={g.id} style={{
                padding: '1.25rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                marginBottom: '0.75rem',
              }}>
                <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{g.description}</p>
                <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                  {g.duration_days} days · {g.start_date} → {g.end_date}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Chapter timeline */}
        {theme?.chapter_titles?.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <SectionTitle>The Arc</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {theme.chapter_titles.map((title, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent)', color: '#fff',
                      display: 'grid', placeItems: 'center',
                      fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</span>
                    {i < theme.chapter_titles.length - 1 && (
                      <span style={{ width: 2, height: 40, background: 'var(--border)' }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', letterSpacing: '0.08em' }}>
                      WEEK {i + 1}
                    </span>
                    <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>{title}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today's tasks */}
        <section style={{ marginBottom: '3rem' }}>
          <SectionTitle>Today</SectionTitle>
          {today_tasks?.length > 0 ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {today_tasks.map(t => (
                <li key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  opacity: t.completed ? 0.55 : 1,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${t.completed ? 'var(--accent)' : 'var(--border)'}`,
                    background: t.completed ? 'var(--accent)' : 'transparent',
                  }} />
                  <span style={{ textDecoration: t.completed ? 'line-through' : 'none', fontSize: '0.92rem' }}>
                    {t.content}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>No tasks scheduled today.</p>
          )}
        </section>

        {/* Signal Wall */}
        <section>
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
      fontSize: '0.8rem',
      letterSpacing: '0.15em',
      color: 'var(--fg-muted)',
      fontWeight: 700,
      textTransform: 'uppercase',
      marginBottom: '1rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </h2>
  )
}
