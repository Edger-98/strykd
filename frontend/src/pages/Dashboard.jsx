import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutGrid, Radio, ExternalLink, LogOut, Menu, X, User as UserIcon,
  CreditCard, Lock, Flame, ArrowRight, Loader2, PartyPopper,
} from 'lucide-react'
import Checklist from '../components/Checklist'
import ReplanPanel from '../components/ReplanPanel'
import SignalWall from '../components/SignalWall'
import { useCountUp } from '../hooks'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'

export default function Dashboard() {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('today')
  const [navOpen, setNavOpen] = useState(false)
  const [subBusy, setSubBusy] = useState(false)
  const [subError, setSubError] = useState('')
  // captured once on mount, before the strip effect clears them
  const [justSubscribed] = useState(() => searchParams.get('checkout') === 'success')
  const [welcome] = useState(() => searchParams.get('welcome') === '1')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const subscribe = async () => {
    setSubBusy(true); setSubError('')
    try {
      const { checkout_url } = await api.checkout()
      if (checkout_url) window.location.href = checkout_url
      else { setSubBusy(false); setSubError('Could not start checkout. Please try again.') }
    } catch (e) { setSubBusy(false); setSubError(e.message) }
  }

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

  useEffect(() => {
    if (searchParams.get('checkout') || searchParams.get('welcome')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const onTaskComplete = (taskId, newStreak) => {
    setData(d => ({
      ...d,
      user: { ...d.user, streak_days: newStreak },
      today_tasks: d.today_tasks.map(t => t.id === taskId ? { ...t, completed: true } : t),
    }))
  }

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading…</Centered>

  const { user, goals, today_tasks, signal_wall, trial } = data
  const goalId = goals?.[0]?.id
  const taskDate = today_tasks?.[0]?.task_date || new Date().toISOString().slice(0, 10)
  const done = today_tasks.filter(t => t.completed).length
  const total = today_tasks.length
  const pct = total ? Math.round((done / total) * 100) : 0

  // Day 8+ with no subscription, full-screen upgrade lock (unless they just paid)
  if (trial?.locked && !justSubscribed) {
    return <UpgradePrompt user={user} subscribe={subscribe} busy={subBusy} error={subError}
      onLogout={() => { clearToken(); nav('/') }} />
  }

  const subscribed = trial?.subscription_active || justSubscribed
  const endingSoon = trial?.ending_soon && !subscribed
  const daysLeft = trial?.days_left

  return (
    <div style={S.shell}>
      {/* ── Sidebar ── */}
      <aside className={`dash-sidebar${navOpen ? ' open' : ''}`} style={S.sidebar}>
        <div style={S.sideTop}>
          <span style={S.logo}>STRYKD</span>
          <button style={S.icon} onClick={() => setNavOpen(false)}><X size={18} /></button>
        </div>

        {/* avatar */}
        <div style={S.profile}>
          <div style={S.avatar}><UserIcon size={20} color="var(--d-text-dim)" /></div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ color: 'var(--d-text-muted)', fontSize: '0.78rem' }}>@{user.slug}</div>
          </div>
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

        <div style={{ marginTop: 'auto' }}>
          <button style={S.logout} onClick={() => { clearToken(); nav('/') }}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      {navOpen && <div style={S.overlay} onClick={() => setNavOpen(false)} />}

      {/* ── Main ── */}
      <motion.main className="dash-main" style={S.main} variants={pageVariants} initial="initial" animate="animate">
        <header style={S.header}>
          <button className="dash-menu-btn" style={S.icon} onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <div style={{ flex: 1 }}>
            <p style={S.date}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="h-lg display" style={{ marginTop: 6 }}>Hello, {user.name.split(' ')[0]}</h1>
          </div>
          {subscribed ? (
            <span style={{ ...S.trialBadge, color: '#34C759', borderColor: '#34C759', background: 'rgba(52,199,89,0.12)' }}>
              <span style={{ ...S.trialDot, background: '#34C759' }} /> Subscribed
            </span>
          ) : !endingSoon && daysLeft != null ? (
            <span style={S.trialBadge}>
              <span style={S.trialDot} /> Free trial · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
            </span>
          ) : null}
        </header>

        {/* Day-6/7 persistent banner */}
        {endingSoon && (
          <motion.div style={S.endBanner} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <Flame size={20} color="var(--red)" style={{ flexShrink: 0 }} />
              <span><strong>Your free week ends tomorrow.</strong> Keep your streak alive.</span>
            </span>
            <button className="pill pill-blue pill-sm" onClick={subscribe} disabled={subBusy} style={{ flexShrink: 0 }}>
              {subBusy ? <Loader2 size={15} className="spin-icon" /> : <><CreditCard size={15} /> Subscribe for $9/month</>}
            </button>
          </motion.div>
        )}

        {/* One-time welcome / subscribed confirmation */}
        {(welcome || justSubscribed) && !bannerDismissed && (
          <motion.div style={S.welcomeBanner} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <PartyPopper size={18} color="var(--blue)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              {justSubscribed
                ? <><strong>You're subscribed.</strong> Thanks for backing yourself. Keep showing up.</>
                : <><strong>Your free week has started.</strong> Full access, no card. Now show up and don't break the streak.</>}
            </span>
            <button onClick={() => setBannerDismissed(true)} style={S.icon} aria-label="Dismiss"><X size={16} /></button>
          </motion.div>
        )}

        {tab === 'today' ? (
          <div>
            {/* streak + progress */}
            <div style={S.statRow}>
              <StreakCard streak={user.streak_days} />
              <div style={S.progCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{done}<span style={{ color: 'var(--d-text-muted)', fontWeight: 400 }}>/{total}</span></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: pct === 100 ? 'var(--blue)' : 'var(--d-text-dim)' }}>
                    {pct === 100 ? 'complete' : `${pct}% done today`}
                  </span>
                </div>
                <div style={S.bar}>
                  <motion.div style={{ height: '100%', background: 'var(--blue)', borderRadius: 5 }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              </div>
            </div>

            <h2 className="eyebrow" style={S.sectionTitle}>Today's Tasks</h2>
            <Checklist tasks={today_tasks} onUpdate={onTaskComplete} />
            {goalId && <ReplanPanel goalId={goalId} taskDate={taskDate} onConfirmed={load} />}
          </div>
        ) : (
          <div>
            <h2 className="eyebrow" style={S.sectionTitle}>Signal Wall</h2>
            <SignalWall entries={signal_wall} dark />
          </div>
        )}
      </motion.main>
    </div>
  )
}

function NavItem({ active, Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}>
      <Icon size={18} color={active ? 'var(--red)' : 'var(--d-text-dim)'} /> <span>{label}</span>
    </button>
  )
}

function StreakCard({ streak }) {
  const n = useCountUp(streak)
  return (
    <div style={S.streakCard}>
      <div style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--d-text-muted)', letterSpacing: '0.12em', fontWeight: 700, marginTop: 8 }}>DAY STREAK</div>
    </div>
  )
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--d-bg)' }}>
      <p style={{ color: 'var(--d-text-dim)' }}>{children}</p>
    </div>
  )
}

function UpgradePrompt({ user, subscribe, busy, error, onLogout }) {
  return (
    <div style={S.lockShell}>
      <motion.div style={S.lockCard} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
        <div style={S.lockIcon}><Lock size={26} color="var(--red)" /></div>
        <h1 className="h-lg display" style={{ marginBottom: 12 }}>Your free week has ended.</h1>
        <p style={{ color: 'var(--d-text-dim)', fontSize: '1.05rem', lineHeight: 1.55, marginBottom: 8 }}>
          {user.streak_days > 0
            ? <>Don't lose your <strong style={{ color: 'var(--red)' }}>{user.streak_days}-day streak</strong>. Subscribe to keep your plan, your AI coach, and your momentum.</>
            : <>Subscribe to unlock your daily plan, your AI coach, and keep your momentum going.</>}
        </p>
        <p style={{ color: 'var(--d-text-muted)', fontSize: '0.9rem', marginBottom: 28 }}>
          Just $9/month. Your public page stays live either way.
        </p>

        {error && <p style={{ color: 'var(--red)', fontSize: '0.88rem', marginBottom: 16 }}>{error}</p>}

        <button className="pill pill-blue pill-lg" onClick={subscribe} disabled={busy} style={{ width: '100%' }}>
          {busy ? <Loader2 size={18} className="spin-icon" /> : <><CreditCard size={18} /> Subscribe for $9/month <ArrowRight size={16} /></>}
        </button>

        <div style={S.lockFoot}>
          {user.page_public !== false && (
            <a href={`/${user.slug}`} target="_blank" rel="noreferrer" style={S.lockLink}>
              <ExternalLink size={14} /> View your public page
            </a>
          )}
          <button onClick={onLogout} style={S.lockLink}><LogOut size={14} /> Log out</button>
        </div>
      </motion.div>
    </div>
  )
}

const SIDEBAR_W = 260
const S = {
  shell: { minHeight: '100vh', background: 'var(--d-panel)', display: 'flex', color: 'var(--d-text)' },
  sidebar: {
    width: SIDEBAR_W, flexShrink: 0, background: 'var(--d-bg)', borderRight: '1px solid var(--d-line)',
    display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'fixed', top: 0, bottom: 0, left: 0,
    transition: 'transform 0.25s var(--ease)', zIndex: 30,
  },
  sideTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', marginBottom: 24 },
  logo: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1rem' },
  profile: { display: 'flex', gap: 12, alignItems: 'center', padding: '12px', background: 'var(--d-card)', borderRadius: 14, marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'var(--d-line)', display: 'grid', placeItems: 'center', flexShrink: 0 },
  navList: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', background: 'transparent', border: 'none',
    borderRadius: 12, color: 'var(--d-text-dim)', fontSize: '0.92rem', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s var(--ease)' },
  navItemActive: { background: 'var(--d-card)', color: 'var(--d-text)' },
  logout: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', width: '100%', background: 'transparent',
    border: 'none', color: 'var(--d-text-muted)', fontSize: '0.88rem', fontWeight: 500, borderRadius: 12 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20 },
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '40px clamp(20px, 5vw, 56px)', maxWidth: 860, width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36, flexWrap: 'wrap' },
  date: { color: 'var(--d-text-muted)', fontSize: '0.82rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 },
  trialBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 50,
    background: 'rgba(0,113,227,0.12)', border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' },
  trialDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)' },
  endBanner: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '14px 20px', marginBottom: 24,
    borderRadius: 14, background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.4)', color: 'var(--d-text)', fontSize: '0.92rem' },
  welcomeBanner: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginBottom: 24,
    borderRadius: 14, background: 'rgba(0,113,227,0.1)', border: '1px solid var(--blue)', color: 'var(--d-text)', fontSize: '0.9rem', lineHeight: 1.5 },
  lockShell: { minHeight: '100vh', background: 'var(--d-bg)', display: 'grid', placeItems: 'center', padding: 24 },
  lockCard: { width: '100%', maxWidth: 460, background: 'var(--d-panel)', border: '1px solid var(--d-line)', borderRadius: 24,
    padding: 'clamp(28px, 5vw, 44px)', textAlign: 'center', color: 'var(--d-text)' },
  lockIcon: { width: 60, height: 60, borderRadius: 18, background: 'rgba(255,45,45,0.12)', display: 'grid', placeItems: 'center', margin: '0 auto 24px' },
  lockFoot: { display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24, flexWrap: 'wrap' },
  lockLink: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--d-text-muted)', fontSize: '0.85rem', fontWeight: 500 },
  statRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 },
  streakCard: { flex: '1 1 140px', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24 },
  progCard: { flex: '2 1 220px', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  bar: { height: 8, background: 'var(--d-bg)', borderRadius: 5, overflow: 'hidden' },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 8, paddingBottom: 12, borderBottom: '1px solid var(--d-line)' },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
}
