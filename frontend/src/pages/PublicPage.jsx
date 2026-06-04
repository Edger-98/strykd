import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Flame, ArrowDown, Check } from 'lucide-react'
import GridBackground from '../components/GridBackground'
import SignalWall from '../components/SignalWall'
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
    <div className="page-enter" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <GridBackground wash="rb" markers />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 860, margin: '0 auto', padding: '0 1.5rem 7rem' }}>
        {/* ── Cinematic hero ── */}
        <section style={S.hero}>
          <div className="anim-up d1" style={S.heroTop}>
            <span style={S.brand}>STRYKD</span>
            <span style={S.streak}>
              <Flame size={14} color="var(--red)" /> {user.streak_days} DAY STREAK
            </span>
          </div>

          <p className="eyebrow anim-up d2" style={{ marginBottom: '1.5rem' }}>{user.name}</p>

          {theme?.mission_statement && (
            <h1 className="display h-giant anim-up-lg d3" style={{ maxWidth: 920 }}>
              {firstSentence(theme.mission_statement)}
            </h1>
          )}

          {theme?.daily_headline && (
            <p className="anim-up d6" style={S.headline}>
              <span className="gradient-rb">{theme.daily_headline}</span>
            </p>
          )}

          {theme?.mission_statement && rest(theme.mission_statement) && (
            <p className="anim-up d7" style={S.missionRest}>{rest(theme.mission_statement)}</p>
          )}

          <div className="anim-fade d8" style={S.scroll}>
            <ArrowDown size={16} /> SCROLL
          </div>
        </section>

        {/* ── The Commitment ── */}
        {goals?.length > 0 && (
          <Reveal>
            <Eyebrow>The Commitment</Eyebrow>
            {goals.map(g => (
              <div key={g.id} className="card" style={{ padding: '1.75rem' }}>
                <p style={{ fontSize: '1.3rem', lineHeight: 1.4, fontWeight: 600, marginBottom: '1rem' }}>{g.description}</p>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>
                  {g.duration_days} DAYS · {g.start_date} → {g.end_date}
                </span>
              </div>
            ))}
          </Reveal>
        )}

        {/* ── The Arc ── */}
        {theme?.chapter_titles?.length > 0 && (
          <Reveal>
            <Eyebrow>The Arc</Eyebrow>
            <div>
              {theme.chapter_titles.map((title, i) => (
                <div key={i} style={{ display: 'flex', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={S.weekNum}>{String(i + 1).padStart(2, '0')}</span>
                    {i < theme.chapter_titles.length - 1 && (
                      <span style={{ width: 1, flex: 1, minHeight: 44, background: 'var(--line-bright)' }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 4, paddingBottom: '1.75rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 700 }}>
                      WEEK {i + 1}
                    </span>
                    <p className="display" style={{ fontSize: '1.5rem', marginTop: 4, letterSpacing: '-0.02em' }}>{title}</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {today_tasks.map(t => (
                <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem',
                  padding: '1rem 1.1rem', opacity: t.completed ? 0.5 : 1 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${t.completed ? 'var(--blue)' : 'var(--line-bright)'}`,
                    background: t.completed ? 'var(--blue)' : 'transparent',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {t.completed && <Check size={13} color="var(--black)" strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: '0.96rem', textDecoration: t.completed ? 'line-through' : 'none',
                    color: t.completed ? 'var(--text-muted)' : 'var(--white)' }}>
                    {t.content}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No tasks scheduled today.</p>
          )}
        </Reveal>

        {/* ── Signal Wall ── */}
        <Reveal>
          <Eyebrow>Signal Wall</Eyebrow>
          <SignalWall entries={signal_wall} />
        </Reveal>

        <footer style={S.footer}>
          Built with <span style={{ color: 'var(--red)', fontWeight: 700 }}>STRYKD</span> — AI accountability that ships.
        </footer>
      </div>
    </div>
  )
}

function firstSentence(text) {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}
function rest(text) {
  const first = firstSentence(text)
  return text.slice(first.length).trim()
}

function Reveal({ children }) {
  const ref = useReveal()
  return <section ref={ref} className="reveal" style={{ marginTop: '5rem' }}>{children}</section>
}

function Eyebrow({ children }) {
  return (
    <h2 className="eyebrow" style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line)' }}>
      {children}
    </h2>
  )
}

function Splash({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--black)' }}>
      <p style={{ color: 'var(--text-dim)' }}>{children}</p>
    </div>
  )
}

function SkeletonPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', maxWidth: 860, margin: '0 auto', padding: '7rem 1.5rem' }}>
      <div className="skeleton" style={{ height: 20, width: 120, marginBottom: '2.5rem' }} />
      <div className="skeleton" style={{ height: 90, width: '85%', marginBottom: '1rem' }} />
      <div className="skeleton" style={{ height: 90, width: '60%', marginBottom: '2rem' }} />
      <div className="skeleton" style={{ height: 24, width: '70%' }} />
    </div>
  )
}

const S = {
  hero: { minHeight: '88vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '4rem' },
  heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' },
  brand: { fontSize: '0.85rem', letterSpacing: '0.2em', fontWeight: 800, color: 'var(--text-dim)' },
  streak: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em' },
  headline: { fontSize: 'clamp(1.2rem, 2.8vw, 1.7rem)', fontWeight: 700, marginTop: '2rem', maxWidth: 700, lineHeight: 1.3 },
  missionRest: { color: 'var(--text-dim)', fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', lineHeight: 1.6, marginTop: '1.5rem', maxWidth: 640 },
  scroll: { marginTop: '3.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em', fontWeight: 600 },
  weekNum: { width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line-bright)', color: 'var(--white)',
    display: 'grid', placeItems: 'center', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0, background: 'var(--surface)' },
  footer: { marginTop: '6rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' },
}
