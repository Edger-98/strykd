import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Menu, X, Plus, Target as TargetIcon, Loader2, PartyPopper,
} from 'lucide-react'
import Checklist from '../components/Checklist'
import Celebration from '../components/Celebration'
import ReplanPanel from '../components/ReplanPanel'
import SignalWall from '../components/SignalWall'
import DashSidebar, { SIDEBAR_W } from '../components/DashSidebar'
import AddGoalModal from '../components/AddGoalModal'
import ContributionGrid from '../components/ContributionGrid'
import DayDrawer from '../components/DayDrawer'
import ShareBar from '../components/ShareBar'
import PushPrompt from '../components/PushPrompt'
import { useCountUp } from '../hooks'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'
import { ensureOneSignal } from '../onesignal'

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n).trimEnd() + '…' : s)

// Goals are sometimes phrased with a leading time-frame clause
// ("Within the next 90 days, cover all expenses…"). Strip that lead-in so the
// switcher pill shows the actual goal, not the deadline.
const goalLabel = (d) => {
  if (!d) return d
  const stripped = d.replace(
    /^(?:with(?:in)?|in|over|by|during|across)\b[^,]*\b(?:days?|weeks?|months?|years?|quarters?)\b[^,]*,\s*/i,
    '',
  ).trim()
  if (!stripped) return d
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default function Dashboard() {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const tab = searchParams.get('tab') === 'signal' ? 'signal' : 'today'
  const [welcome] = useState(() => searchParams.get('welcome') === '1')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [gridDay, setGridDay] = useState(null)
  const [celebration, setCelebration] = useState(null)

  const load = useCallback(() => {
    api.dashboard().then(d => {
      setData(d)
      setSelectedGoalId(prev => {
        const ids = (d.goals || []).map(g => g.id)
        return ids.includes(prev) ? prev : (ids[0] || null)
      })
    }).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else setError(e.message)
    })
  }, [nav])

  const addQuick = async () => {
    const c = quickInput.trim()
    if (!c || quickBusy) return
    setQuickBusy(true)
    try {
      const t = await api.addQuickTask(c)
      setData(d => ({ ...d, quick_tasks: [...(d.quick_tasks || []), t] }))
      setQuickInput('')
    } catch (e) { /* ignore */ } finally { setQuickBusy(false) }
  }

  useEffect(() => {
    if (!getToken()) { nav('/'); return }
    load()
  }, [load, nav])

  // Capture the browser timezone once so streak reminders fire at the right local time
  useEffect(() => {
    if (!data?.user) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== data.user.timezone) {
      api.updateMe({ timezone: tz }).catch(() => {})
    }
  }, [data?.user])

  // Identify the user to OneSignal so the backend can target their push.
  useEffect(() => {
    if (data?.user?.id) ensureOneSignal(data.user.id)
  }, [data?.user?.id])

  useEffect(() => {
    if (searchParams.get('welcome')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // res = { goal_id, streak_days, user_streak }
  const onTaskComplete = (taskId, res) => {
    setData(d => ({
      ...d,
      user: { ...d.user, streak_days: res.user_streak ?? d.user.streak_days },
      goals: (d.goals || []).map(g =>
        res.goal_id && g.id === res.goal_id
          ? { ...g, streak_days: res.streak_days, today_tasks: g.today_tasks.map(t => t.id === taskId ? { ...t, completed: true } : t) }
          : g
      ),
      quick_tasks: (d.quick_tasks || []).map(t => t.id === taskId ? { ...t, completed: true } : t),
    }))
    if (res?.celebration) setCelebration(res.celebration)
  }

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading…</Centered>

  // Strykd is free: the trial countdown/subscribed badge, the "trial ends soon"
  // banner, and the day-46 upgrade lock screen were all removed. `trial` is still
  // destructured because the backend keeps the key (a free, never-locked stub) and
  // PushPrompt reads trial?.day (now null) — see trial.py for the backend side.
  const { user, goals = [], quick_tasks = [], signal_wall, trial } = data

  const activeGoal = goals.find(g => g.id === selectedGoalId) || goals[0] || null
  const goalTasks = activeGoal?.today_tasks || []
  const ctxTasks = activeGoal ? goalTasks : quick_tasks
  const done = ctxTasks.filter(t => t.completed).length
  const total = ctxTasks.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const streakValue = activeGoal ? activeGoal.streak_days : user.streak_days
  const taskDate = goalTasks[0]?.task_date || new Date().toISOString().slice(0, 10)

  return (
    <div style={S.shell}>
      <DashSidebar user={user} active={tab} navOpen={navOpen} setNavOpen={setNavOpen}
        onLogout={() => { clearToken(); nav('/') }} onAddGoal={() => setAddOpen(true)} />

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
        </header>

        {/* One-time welcome */}
        {welcome && !bannerDismissed && (
          <motion.div style={S.welcomeBanner} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <PartyPopper size={18} color="var(--blue)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <strong>You're all set.</strong> Full access to everything, free. Now show up and don't break the streak.
            </span>
            <button onClick={() => setBannerDismissed(true)} style={S.icon} aria-label="Dismiss"><X size={16} /></button>
          </motion.div>
        )}

        {tab === 'today' ? (
          <div>
            <PushPrompt trialDay={trial?.day} pushEnabled={user.push_enabled}
              userId={user.id} onEnabled={load} />

            {/* Goal switcher */}
            <GoalSwitcher goals={goals} selectedId={activeGoal?.id} onSelect={setSelectedGoalId} onAdd={() => setAddOpen(true)} />

            {/* streak + progress (reflects the active goal, or personal/quick if none) */}
            <div style={S.statRow}>
              <StreakCard streak={streakValue} label={activeGoal ? 'DAY STREAK' : 'PERSONAL STREAK'} />
              <div style={S.progCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{done}<span style={{ color: 'var(--d-text-muted)', fontWeight: 400 }}>/{total}</span></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: pct === 100 ? 'var(--blue)' : 'var(--d-text-dim)' }}>
                    {total ? (pct === 100 ? 'complete' : `${pct}% done today`) : 'nothing scheduled'}
                  </span>
                </div>
                <div style={S.bar}>
                  <motion.div style={{ height: '100%', background: 'var(--blue)', borderRadius: 5 }}
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              </div>
            </div>

            {activeGoal?.grid?.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <h2 className="eyebrow" style={S.sectionTitle}>Consistency</h2>
                <ContributionGrid days={activeGoal.grid} dark onPickDay={setGridDay} />
                {user.page_public !== false && (
                  <div style={{ marginTop: 18 }}>
                    <ShareBar dark name={user.name} slug={user.slug} goals={goals}
                      publicUrl={`${window.location.origin}/${user.slug}`} />
                  </div>
                )}
              </section>
            )}

            {activeGoal ? (
              <>
                <h2 className="eyebrow" style={S.sectionTitle}>Today's Tasks</h2>
                <Checklist tasks={goalTasks} onComplete={onTaskComplete} reload={load} goalName={activeGoal.description} />
                <ReplanPanel goalId={activeGoal.id} taskDate={taskDate} onConfirmed={load} />
              </>
            ) : (
              <div style={S.emptyGoals}>
                <TargetIcon size={28} color="var(--d-text-muted)" />
                <p style={{ color: 'var(--d-text-dim)', margin: '12px 0 16px' }}>No AI goal yet. Add one to get a personalized daily plan.</p>
                <button className="pill pill-red pill-sm" onClick={() => setAddOpen(true)}><Plus size={15} /> Add a goal</button>
              </div>
            )}

            {/* Quick tasks (manual, no goal needed) */}
            <section style={{ marginTop: 44 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--d-line)', marginBottom: 8, paddingBottom: 12 }}>
                <h2 className="eyebrow" style={{ color: 'var(--d-text-muted)' }}>Your tasks</h2>
                <button onClick={() => nav('/dashboard/tasks')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  Manage all tasks →
                </button>
              </div>
              <div style={S.quickRow}>
                <input value={quickInput} onChange={e => setQuickInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addQuick()} placeholder="Add a quick task and press Enter"
                  style={S.quickInput} />
                <button className="pill pill-dark pill-sm" onClick={addQuick} disabled={quickBusy}>
                  {quickBusy ? <Loader2 size={15} className="spin-icon" /> : <><Plus size={15} /> Add task</>}
                </button>
              </div>
              {quick_tasks.length > 0
                ? <div style={{ marginTop: 8 }}><Checklist tasks={quick_tasks} onComplete={onTaskComplete} reload={load} /></div>
                : <p style={{ color: 'var(--d-text-muted)', fontSize: '0.9rem', marginTop: 14 }}>No quick tasks yet. Jot down anything you want to get done today.</p>}
            </section>
          </div>
        ) : (
          <div>
            <h2 className="eyebrow" style={S.sectionTitle}>Signal Wall</h2>
            <SignalWall entries={signal_wall} dark />
          </div>
        )}
      </motion.main>

      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
      <DayDrawer day={gridDay} onClose={() => setGridDay(null)} dark accent="var(--red)" />
      <Celebration data={celebration} onDone={() => setCelebration(null)} />
    </div>
  )
}

function GoalSwitcher({ goals, selectedId, onSelect, onAdd }) {
  return (
    <div style={S.switcher}>
      {goals.map(g => {
        const active = g.id === selectedId
        return (
          <button key={g.id} onClick={() => onSelect(g.id)}
            style={{ ...S.goalTab, ...(active ? S.goalTabActive : {}) }}>
            {truncate(goalLabel(g.description), 20)}
          </button>
        )
      })}
      <button onClick={onAdd} style={S.goalAdd} title="Add another goal" aria-label="Add another goal"><Plus size={16} /></button>
    </div>
  )
}

function StreakCard({ streak, label = 'DAY STREAK' }) {
  const n = useCountUp(streak)
  return (
    <div style={S.streakCard}>
      <div style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--d-text-muted)', letterSpacing: '0.12em', fontWeight: 700, marginTop: 8 }}>{label}</div>
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


const S = {
  shell: { minHeight: '100vh', background: 'var(--d-panel)', display: 'flex', color: 'var(--d-text)' },
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
  switcher: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  goalTab: { padding: '8px 16px', borderRadius: 50, background: 'var(--d-card)', border: '1px solid var(--d-line)',
    color: 'var(--d-text-dim)', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s var(--ease)' },
  goalTabActive: { background: 'rgba(255,45,45,0.12)', borderColor: 'var(--red)', color: 'var(--red)' },
  goalAdd: { width: 36, height: 36, borderRadius: '50%', background: 'var(--d-card)', border: '1px dashed var(--d-line)',
    color: 'var(--d-text-dim)', display: 'grid', placeItems: 'center', flexShrink: 0 },
  emptyGoals: { textAlign: 'center', padding: '40px 24px', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16 },
  quickRow: { display: 'flex', gap: 10, alignItems: 'stretch' },
  quickInput: { flex: 1, background: 'var(--d-bg)', color: 'var(--d-text)', border: '1px solid var(--d-line)',
    borderRadius: 12, padding: '12px 16px', fontSize: '0.95rem', outline: 'none' },
  statRow: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 },
  streakCard: { flex: '1 1 140px', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24 },
  progCard: { flex: '2 1 220px', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  bar: { height: 8, background: 'var(--d-bg)', borderRadius: 5, overflow: 'hidden' },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 8, paddingBottom: 12, borderBottom: '1px solid var(--d-line)' },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
}
