import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignalWall from '../components/SignalWall'
import ThemeWrapper from '../components/ThemeWrapper'
import { useReveal } from '../hooks'
import { api } from '../api'

export default function PublicPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.publicPage(slug).then(setData).catch(() => setError('This page does not exist.'))
  }, [slug])

  if (error) return <Splash>{error}</Splash>
  if (!data) return <SkeletonPage />

  const { user, theme, goals, today_tasks, signal_wall } = data

  return (
    <ThemeWrapper theme={theme}>
      <div className="page-enter" style={{ minHeight: '100vh', position: 'relative' }}>
        {/* Atmospheric gradient wash */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, var(--accent-glow), transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '0 1.5rem 6rem' }}>
          {/* ── Cinematic hero ── */}
          <section style={{
            minHeight: '78vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
            paddingTop: '4rem',
          }}>
            <div className="anim-up d1" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.8rem', letterSpacing: '0.2em', color: 'var(--fg-muted)', fontWeight: 700 }}>
                STRYKD
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>
                🔥 {user.streak_days} DAY STREAK
              </span>
            </div>

            <h1 className="anim-up-lg d2" style={{
              fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-display)',
              letterSpacing: 'var(--ls-display)', lineHeight: 'var(--lh-display)',
              fontSize: 'clamp(3rem, 12vw, 6rem)',
              textTransform: theme?.typography_variant === 'bold-condensed' ? 'uppercase' : 'none',
            }}>
              {user.name}
            </h1>

            {theme?.daily_headline && (
              <p className="anim-up d4" style={{
                color: 'var(--accent)', fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
                fontWeight: 600, marginTop: '1.5rem', maxWidth: 600,
              }}>
                {theme.daily_headline}
              </p>
            )}

            {theme?.mission_statement && (
              <p className="anim-up d6" style={{
                color: 'var(--fg-dim)', fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
                lineHeight: 1.6, marginTop: '1.5rem', maxWidth: 620,
                fontStyle: theme?.typography_variant === 'editorial' ? 'italic' : 'normal',
              }}>
                {theme.mission_statement}
              </p>
            )}

            <div className="anim-fade d8" style={{ marginTop: '3rem', color: 'var(--fg-muted)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
              ↓ SCROLL
            </div>
          </section>

          {/* ── Goals ── */}
          {goals?.length > 0 && (
            <Reveal>
              <Eyebrow>The Commitment</Eyebrow>
              {goals.map(g => (
                <div key={g.id} className="card" style={{ padding: '1.5rem', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '1.15rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>{g.description}</p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', letterSpacing: '0.05em' }}>
                    {g.duration_days} DAYS · {g.start_date} → {g.end_date}
                  </span>
                </div>
              ))}
            </Reveal>
          )}

          {/* ── Chapter timeline ── */}
          {theme?.chapter_titles?.length > 0 && (
            <Reveal>
              <Eyebrow>The Arc</Eyebrow>
              <div>
                {theme.chapter_titles.map((title, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{
                        width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                        display: 'grid', placeItems: 'center', fontSize: '0.9rem', fontWeight: 800, flexShrink: 0,
                      }}>{i + 1}</span>
                      {i < theme.chapter_titles.length - 1 && (
                        <span style={{ width: 2, flex: 1, minHeight: 40, background: 'var(--border)' }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 6, paddingBottom: '1.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', letterSpacing: '0.1em', fontWeight: 600 }}>
                        WEEK {i + 1}
                      </span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 2 }}>{title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* ── Today ── */}
          <Reveal>
            <Eyebrow>Today</Eyebrow>
            {today_tasks?.length > 0 ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {today_tasks.map(t => (
                  <li key={t.id} className="card" style={{
                    display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem',
                    opacity: t.completed ? 0.5 : 1,
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${t.completed ? 'var(--accent)' : 'var(--border)'}`,
                      background: t.completed ? 'var(--accent)' : 'transparent',
                    }} />
                    <span style={{ textDecoration: t.completed ? 'line-through' : 'none', fontSize: '0.98rem' }}>
                      {t.content}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>No tasks scheduled today.</p>
            )}
          </Reveal>

          {/* ── Signal Wall ── */}
          <Reveal>
            <Eyebrow>Signal Wall</Eyebrow>
            <SignalWall entries={signal_wall} />
          </Reveal>

          <footer style={{ marginTop: '5rem', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
            Built with <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Strykd</span> — AI accountability that ships.
          </footer>
        </div>
      </div>
    </ThemeWrapper>
  )
}

function Reveal({ children }) {
  const ref = useReveal()
  return <section ref={ref} className="reveal" style={{ marginTop: '4rem' }}>{children}</section>
}

function Eyebrow({ children }) {
  return (
    <h2 style={{
      fontSize: '0.78rem', letterSpacing: '0.18em', color: 'var(--fg-muted)', fontWeight: 700,
      textTransform: 'uppercase', marginBottom: '1.25rem', paddingBottom: '0.6rem',
      borderBottom: '1px solid var(--border)',
    }}>{children}</h2>
  )
}

function Splash({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0D0805', color: '#A89080' }}>
      <p>{children}</p>
    </div>
  )
}

function SkeletonPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0805', maxWidth: 760, margin: '0 auto', padding: '6rem 1.5rem' }}>
      <div className="skeleton" style={{ height: 24, width: 120, marginBottom: '3rem' }} />
      <div className="skeleton" style={{ height: 80, width: '70%', marginBottom: '1.5rem' }} />
      <div className="skeleton" style={{ height: 24, width: '90%', marginBottom: '0.75rem' }} />
      <div className="skeleton" style={{ height: 24, width: '60%' }} />
    </div>
  )
}
