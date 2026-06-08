import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flame, ArrowDown, Check, Link2, Share2, Heart, Send, Loader2, Play } from 'lucide-react'
import SignalWall from '../components/SignalWall'
import Avatar from '../components/Avatar'
import ContributionGrid from '../components/ContributionGrid'
import DayDrawer from '../components/DayDrawer'
import ShareBar from '../components/ShareBar'
import { inView, revealVariants } from '../motion'
import { api } from '../api'

const THEMES = {
  'dark-ember':   { bg: '#1A0E08', surface: '#241409', fg: '#F5EDE6', dim: '#B89B86', accent: '#FF5A1F' },
  'arctic-focus': { bg: '#0B1B2B', surface: '#12283D', fg: '#EAF4FF', dim: '#9DB6CC', accent: '#0071E3' },
  'soft-earth':   { bg: '#2B2117', surface: '#3A2D20', fg: '#F3ECE1', dim: '#C4B09A', accent: '#C2714F' },
}

export default function PublicPage() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [gridDay, setGridDay] = useState(null)

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

  const { user, theme, goals = [], signal_wall, encouragements = [] } = data
  const t = THEMES[theme?.color_palette] || THEMES['arctic-focus']
  const heroStreak = Math.max(user.streak_days || 0, ...goals.map(g => g.streak_days || 0), 0)

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* ── Cinematic themed hero ── */}
      <section style={{ ...S.hero, background: t.bg, color: t.fg }}>
        <div style={S.heroInner}>
          <motion.div style={S.heroTop} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span style={{ letterSpacing: '0.2em', fontWeight: 800, fontSize: '0.85rem' }}>STRYKD</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.accent, fontWeight: 700, fontSize: '0.8rem' }}>
              <Flame size={14} color={t.accent} /> {heroStreak} DAY STREAK
            </span>
          </motion.div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 0' }}>
            <motion.div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <Avatar src={user.avatar_url} name={user.name} size={56} border={`2px solid ${t.accent}`} />
              <p style={{ ...S.eyebrowT, color: t.dim, marginBottom: 0 }}>
                {user.name}{goals.length ? ` · ${goals.length} active goal${goals.length > 1 ? 's' : ''}` : ''}
              </p>
            </motion.div>
            {theme?.mission_statement && (
              <motion.h1 className="display" style={S.mission}
                initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                {firstSentence(theme.mission_statement)}
              </motion.h1>
            )}
            {user.bio && (
              <motion.p style={{ ...S.headline, color: t.fg, opacity: 0.85, fontWeight: 400 }}
                initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.4 }}>
                {user.bio}
              </motion.p>
            )}
            {theme?.daily_headline && (
              <motion.p style={{ ...S.headline, color: t.accent }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                {theme.daily_headline}
              </motion.p>
            )}
          </div>

          <motion.div style={{ ...S.scroll, color: t.dim }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <ArrowDown size={16} /> SCROLL
          </motion.div>
        </div>
      </section>

      {/* ── Goal sections ── */}
      <div className="container-narrow" style={{ padding: '0 24px 100px' }}>
        {goals.map((g, i) => <GoalSection key={g.id} goal={g} t={t} first={i === 0} onPickDay={setGridDay} />)}

        {/* Signal Wall */}
        <Reveal><section style={{ marginTop: 80 }}>
          <Eyebrow>Signal Wall</Eyebrow>
          <SignalWall entries={signal_wall} avatar={user.avatar_url} name={user.name} />
        </section></Reveal>

        {/* Encouragement */}
        <Reveal><EncourageSection slug={slug} initial={encouragements} accent={t.accent} /></Reveal>

        <div style={{ marginTop: 64, textAlign: 'center' }}>
          <button className="pill pill-dark pill-lg" onClick={share}>
            {copied ? <><Check size={18} /> Copied!</> : <><Link2 size={18} /> Share my page</>}
          </button>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <ShareBar dark={false} label="" name={user.name} goal={goals[0]?.description || 'my goal'}
            day={goals[0]?.progress?.day} streakDays={heroStreak} publicUrl={typeof window !== 'undefined' ? window.location.href : ''}
            grid={goals[0]?.grid || []} />
        </div>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <span style={S.poweredBadge}><Share2 size={13} /> Powered by <strong style={{ marginLeft: 3 }}>Strykd</strong></span>
        </div>
      </div>

      <DayDrawer day={gridDay} onClose={() => setGridDay(null)} dark={false} accent={t.accent} />
    </div>
  )
}

function GoalSection({ goal, t, first, onPickDay }) {
  const p = goal.progress || { pct: 0, day: 1, total_days: goal.duration_days }
  const currentWeek = Math.floor((p.day - 1) / 7)
  return (
    <Reveal><section style={{ marginTop: first ? 80 : 72 }}>
      <Eyebrow>{(goal.life_area || 'goal').replace('-', ' ')}</Eyebrow>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px' }}>
            <h2 className="display" style={{ fontSize: '1.6rem', lineHeight: 1.25, marginBottom: 10 }}>{goal.description}</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--gray-light)', letterSpacing: '0.05em', fontWeight: 600 }}>
              DAY {p.day} OF {p.total_days} · {goal.streak_days} DAY STREAK
            </span>
          </div>
          <ProgressArc pct={p.pct} accent={t.accent} />
        </div>

        {/* contribution grid — the story at a glance */}
        {goal.grid?.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--gray-light)', marginBottom: 14 }}>
              THE STORY SO FAR
            </p>
            <ContributionGrid days={goal.grid} square={16} gap={4} dark={false} onPickDay={onPickDay} />
          </div>
        )}

        {/* chapter timeline */}
        {goal.chapter_titles?.length > 0 && (
          <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {goal.chapter_titles.map((title, i) => {
              const cur = i === currentWeek
              return (
                <div key={i} style={{ padding: 16, borderRadius: 12,
                  background: cur ? t.bg : 'var(--gray-section)', color: cur ? t.fg : 'var(--ink)' }}>
                  <span style={{ fontSize: '0.66rem', letterSpacing: '0.1em', fontWeight: 700, color: cur ? t.accent : 'var(--gray-light)' }}>
                    WEEK {String(i + 1).padStart(2, '0')}{cur ? ' · NOW' : ''}
                  </span>
                  <p className="display" style={{ fontSize: '1rem', marginTop: 4 }}>{title}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* today's tasks */}
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--gray-light)', marginBottom: 12 }}>TODAY</p>
          {goal.today_tasks?.length > 0 ? goal.today_tasks.map((task, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderTop: i ? '1px solid var(--gray-line)' : 'none', opacity: task.completed ? 0.5 : 1 }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'grid', placeItems: 'center',
                border: `2px solid ${task.completed ? t.accent : 'var(--gray-line)'}`, background: task.completed ? t.accent : 'transparent' }}>
                {task.completed && <Check size={12} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ fontSize: '0.95rem', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.content}</span>
            </div>
          )) : <p style={{ color: 'var(--gray-light)' }}>No tasks scheduled today.</p>}
        </div>

        {/* daily proof gallery (recruiter portfolio view) */}
        {goal.proofs?.length > 0 && (
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--gray-line)' }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--gray-light)', marginBottom: 14 }}>
              DAILY PROOF
            </p>
            <div style={S.proofGrid}>
              {goal.proofs.map((pf, i) => (
                <a key={i} href={pf.proof_url} target="_blank" rel="noreferrer" style={S.proofCell} title={pf.date}>
                  {pf.is_video
                    ? <video src={pf.proof_url} style={S.proofMedia} muted preload="metadata" />
                    : <img src={pf.proof_url} alt={`proof from ${pf.date}`} style={S.proofMedia} loading="lazy" />}
                  {pf.is_video && <span style={S.playBadge}><Play size={16} color="#fff" fill="#fff" /></span>}
                  {pf.verified && <span style={S.verifiedBadge}><Check size={11} color="#fff" strokeWidth={3} /></span>}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section></Reveal>
  )
}

function EncourageSection({ slug, initial, accent }) {
  const [list, setList] = useState(initial)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const created = await api.encourage(slug, { visitor_name: name.trim() || 'Someone', message: message.trim() })
      setList(l => [created, ...l].slice(0, 10))
      setMessage(''); setDone(true)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <section style={{ marginTop: 80 }}>
      <Eyebrow>Cheer them on</Eyebrow>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Heart size={20} color={accent} fill={accent} />
          <h3 className="display" style={{ fontSize: '1.3rem' }}>Leave a word of encouragement</h3>
        </div>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.95rem', marginBottom: 20 }}>
          No account needed. Keep it short and kind.
        </p>

        {done ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34C759', fontWeight: 600, marginBottom: 24 }}>
            <Check size={18} /> Thanks for the support.
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginBottom: list.length ? 28 : 0 }}>
            <input className="field" placeholder="Your name (optional)" value={name} maxLength={40}
              onChange={e => setName(e.target.value)} style={{ marginBottom: 10 }} />
            <textarea className="field" placeholder="Keep showing up. You've got this." value={message} maxLength={140} rows={2}
              onChange={e => setMessage(e.target.value)} required style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--gray-light)', fontSize: '0.8rem' }}>{message.length}/140</span>
              <button type="submit" className="pill pill-dark pill-sm" disabled={busy || !message.trim()}>
                {busy ? <Loader2 size={15} className="spin-icon" /> : <><Send size={14} /> Send</>}
              </button>
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 10 }}>{error}</p>}
          </form>
        )}

        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--gray-section)', borderRadius: 12 }}>
                <Avatar name={e.visitor_name} size={34} fontSize={13} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink)' }}>{e.visitor_name}</div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.5, marginTop: 2 }}>{e.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ProgressArc({ pct, accent }) {
  const r = 50, c = 2 * Math.PI * r, size = 124
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-line)" strokeWidth={9} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c - (c * pct) / 100 }} viewport={inView}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1, color: 'var(--ink)' }}>{pct}%</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--gray-light)', letterSpacing: '0.1em', fontWeight: 700 }}>OF GOAL</div>
        </div>
      </div>
    </div>
  )
}

function Reveal({ children }) {
  return <motion.div variants={revealVariants} initial="hidden" whileInView="show" viewport={inView}>{children}</motion.div>
}
function Eyebrow({ children }) {
  return <h2 className="eyebrow" style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--gray-line)', textTransform: 'uppercase' }}>{children}</h2>
}
function firstSentence(text) {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
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
  eyebrowT: { fontSize: '0.85rem', letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 20 },
  mission: { fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 1.05 },
  headline: { fontSize: 'clamp(1.05rem, 2vw, 1.4rem)', fontWeight: 600, marginTop: 24, maxWidth: 560 },
  scroll: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', letterSpacing: '0.15em', fontWeight: 600, paddingBottom: 10 },
  poweredBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 50, background: 'var(--gray-section)', color: 'var(--gray-text)', fontSize: '0.82rem' },
  proofGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 },
  proofCell: { position: 'relative', display: 'block', aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
    background: 'var(--gray-section)', border: '1px solid var(--gray-line)' },
  proofMedia: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  playBadge: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)' },
  verifiedBadge: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%',
    background: '#34C759', display: 'grid', placeItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
}
