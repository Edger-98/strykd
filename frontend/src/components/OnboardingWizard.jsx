import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Briefcase, Dumbbell, Rocket, Palette, Sprout,
  Sunrise, Moon, Globe, Lock, X, Heart, DollarSign, GraduationCap, Plane,
  Brain, Lightbulb, Sun, Pencil, Target, Infinity, Loader2,
} from 'lucide-react'
import { stepVariants } from '../motion'
import GoalChat from './GoalChat'
import { LIFE_AREAS, RECOMMENDED_GOALS } from '../lifeAreas'
import { api } from '../api'

const STEP_BG = {
  goals: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1440&q=80',
}
const LIFE_ICONS = {
  career: Briefcase, fitness: Dumbbell, business: Rocket, creative: Palette,
  'personal-growth': Sprout, sobriety: Sun, relationships: Heart, finance: DollarSign,
  education: GraduationCap, travel: Plane, mindfulness: Brain, 'side-project': Lightbulb,
}
const AESTHETICS = [
  { id: 'dark-ember', label: 'Dark Ember', desc: 'Bold, intense, fire-forged', bg: '#1A0E08', fg: '#F5EDE6', accent: '#FF5A1F' },
  { id: 'arctic-focus', label: 'Arctic Focus', desc: 'Clean, sharp, clinical', bg: '#F2F8FF', fg: '#0B1B2B', accent: '#0071E3' },
  { id: 'soft-earth', label: 'Soft Earth', desc: 'Warm, grounded, organic', bg: '#F3ECE1', fg: '#3A2D20', accent: '#C2714F' },
]

/**
 * Reusable 8-step onboarding wizard. The parent owns submission:
 *   onSubmit(form) -> Promise (set `busy` true while it runs)
 * mode: 'signup' (default) or 'add' (adding another goal in a modal).
 */
export default function OnboardingWizard({ onSubmit, busy, error, mode = 'signup', onClose, initialForm }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [localErr, setLocalErr] = useState('')
  const [form, setForm] = useState(initialForm || {
    goals: '', life_area: '', why_now: '', past_blockers: '',
    duration_days: 7, hours_per_day: 2, daily_rhythm: '',
    aesthetic: '', page_public: true, goal_type: 'sprint', ai_recommended_days: null,
  })
  const [feasBusy, setFeasBusy] = useState(false)
  const [feas, setFeas] = useState(null)  // { recommended_days, message }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addMode = mode === 'add'

  const steps = [
    { key: 'life_area', q: 'Which part of your life?', sub: 'Pick an area, then choose a starter goal or write your own.',
      valid: () => !!form.life_area, custom: true,
      render: () => {
        const recs = RECOMMENDED_GOALS[form.life_area] || []
        return (
          <div>
            <div style={St.areaGrid}>
              {LIFE_AREAS.map(a => {
                const Icon = LIFE_ICONS[a.id] || Sprout
                const active = form.life_area === a.id
                return (
                  <button type="button" key={a.id} onClick={() => set('life_area', a.id)}
                    style={{ ...St.areaCard, outline: active ? '3px solid var(--red)' : '1px solid var(--gray-line)',
                      outlineOffset: active ? -1 : -1 }}>
                    <img src={a.img} alt="" loading="lazy" style={St.areaImg} />
                    <span style={St.areaShade} />
                    <span style={St.areaLabel}><Icon size={15} /> {a.label}</span>
                  </button>
                )
              })}
            </div>

            {form.life_area && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 24 }}>
                <p style={St.recEyebrow}>POPULAR {(LIFE_AREAS.find(a => a.id === form.life_area)?.label || '').toUpperCase()} GOALS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {recs.map(g => (
                    <button type="button" key={g} onClick={() => pickGoal(form.life_area, g)} style={St.recCard}>
                      <span>{g}</span> <ArrowRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                    </button>
                  ))}
                  <button type="button" onClick={() => pickGoal(form.life_area, '')} style={St.recOwn}>
                    <Pencil size={15} /> Write my own goal
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )
      } },
    { key: 'goals', q: 'Let us get clear on your goal.', sub: "Tell me what's on your mind and I'll ask a few questions to sharpen it.",
      valid: () => form.goals.trim().length > 3, chat: true,
      render: () => <GoalChat lifeArea={form.life_area} initialGoal={form.goals} onApprove={approveGoal} /> },
    { key: 'why_now', q: 'Why now?', sub: "What's the urgency? This becomes the fuel. Optional — your coach can ask later.",
      valid: () => true, text: true, optional: true,
      render: () => <textarea autoFocus className="field" style={St.textarea}
        placeholder="What makes this the moment? What's at stake?" value={form.why_now || ''} onChange={e => set('why_now', e.target.value)} /> },
    { key: 'past_blockers', q: 'What has stopped you before?', sub: 'The AI designs tasks to defuse these failure modes. Optional — skip and refine as you go.',
      valid: () => true, text: true, optional: true,
      render: () => <textarea autoFocus className="field" style={St.textarea}
        placeholder="e.g. I start strong then get paralyzed by perfectionism" value={form.past_blockers || ''} onChange={e => set('past_blockers', e.target.value)} /> },
    { key: 'cadence', q: 'How much can you commit?', sub: 'Your plan is sized to fit. No impossible schedules.',
      valid: () => form.goal_type === 'lifestyle' || form.duration_days >= 1, custom: true,
      render: () => {
        const lifestyle = form.goal_type === 'lifestyle'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* timed vs ongoing toggle */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ v: 'sprint', Icon: Target, label: 'Timed goal', desc: 'Has a finish line' },
                { v: 'lifestyle', Icon: Infinity, label: 'Ongoing habit', desc: 'Runs indefinitely' }].map(o => (
                <Choice key={o.v} active={form.goal_type === o.v} onClick={() => { set('goal_type', o.v); setFeas(null) }}
                  style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 8, padding: '1.4rem 1rem', textAlign: 'center' }}>
                  <o.Icon size={26} color={form.goal_type === o.v ? 'var(--red)' : 'var(--gray-text)'} />
                  <span style={{ fontWeight: 700 }}>{o.label}</span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--gray-text)' }}>{o.desc}</span>
                </Choice>
              ))}
            </div>

            {lifestyle ? (
              <p style={{ color: 'var(--gray-text)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                Perfect for habits like sobriety, daily exercise, meditation, journaling, or a reading habit.
                We generate fresh tasks every day and your streak becomes the score.
              </p>
            ) : (
              <Field label="OVER HOW MANY DAYS?"><input type="number" min={1} max={365} className="field"
                value={form.duration_days} onChange={e => { set('duration_days', Number(e.target.value)); setFeas(null) }} /></Field>
            )}

            <Field label="FOCUSED HOURS PER DAY? (OPTIONAL)"><input type="number" min={1} max={16} className="field"
              placeholder="Leave blank to let us size it" value={form.hours_per_day ?? ''}
              onChange={e => set('hours_per_day', e.target.value === '' ? null : Number(e.target.value))} /></Field>

            {feas && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={St.feasBox}>
                <p style={{ lineHeight: 1.6 }}>{feas.message}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="pill pill-dark pill-sm" onClick={acceptRecommendation}>
                    Extend to {feas.recommended_days} days
                  </button>
                  <button className="pill pill-outline pill-sm" onClick={keepTimeline}>
                    Keep my {form.duration_days} days
                  </button>
                </div>
              </motion.div>
            )}

            <button className="pill pill-dark" onClick={cadenceContinue} disabled={feasBusy} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              {feasBusy ? <Loader2 size={16} className="spin-icon" /> : <>Continue <ArrowRight size={16} /></>}
            </button>
          </div>
        )
      } },
    { key: 'daily_rhythm', q: 'When are you sharpest?', sub: 'The heaviest work goes into your peak window. Optional.',
      valid: () => true, optional: true,
      render: () => (
        <div style={{ display: 'flex', gap: 12 }}>
          {[{ id: 'morning', Icon: Sunrise, label: 'Morning' }, { id: 'evening', Icon: Moon, label: 'Evening' }].map(r => (
            <Choice key={r.id} active={form.daily_rhythm === r.id} onClick={() => { set('daily_rhythm', r.id); advance('daily_rhythm') }}
              style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 12, padding: '2rem 1rem' }}>
              <r.Icon size={32} color={form.daily_rhythm === r.id ? 'var(--red)' : 'var(--gray-text)'} />
              <span style={{ fontWeight: 700 }}>{r.label}</span>
            </Choice>
          ))}
        </div>
      ) },
    { key: 'aesthetic', q: 'Pick your visual identity.', sub: 'A live preview of how your page will introduce you.',
      valid: () => !!form.aesthetic,
      render: () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          {AESTHETICS.map(a => (
            <button type="button" key={a.id} onClick={() => { set('aesthetic', a.id); advance('aesthetic') }}
              style={{ ...St.themeCard, borderColor: form.aesthetic === a.id ? 'var(--black)' : 'var(--gray-line)',
                boxShadow: form.aesthetic === a.id ? '0 0 0 4px rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ background: a.bg, borderRadius: 10, padding: 12, marginBottom: 12, height: 104, aspectRatio: '4/3', minHeight: 96, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
                <div style={{ width: 30, height: 4, borderRadius: 2, background: a.accent }} />
                <div style={{ width: '90%', height: 8, borderRadius: 2, background: a.fg, opacity: 0.9 }} />
                <div style={{ width: '60%', height: 8, borderRadius: 2, background: a.fg, opacity: 0.55 }} />
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${a.accent}` }} />
                  <span style={{ flex: 1, height: 6, borderRadius: 2, background: a.fg, opacity: 0.3, alignSelf: 'center' }} />
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.label}</div>
                <div style={{ color: 'var(--gray-text)', fontSize: '0.8rem' }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      ) },
    { key: 'page_public', q: 'Who can see your page?', sub: 'Public pages live on your subdomain and are shareable.',
      valid: () => true,
      render: () => (
        <div style={{ display: 'flex', gap: 12 }}>
          {[{ v: true, Icon: Globe, label: 'Public', desc: 'Shareable, on your subdomain' },
            { v: false, Icon: Lock, label: 'Private', desc: 'Only you, on your dashboard' }].map(o => (
            <Choice key={String(o.v)} active={form.page_public === o.v} onClick={() => set('page_public', o.v)}
              style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 10, padding: '1.75rem 1rem', textAlign: 'center' }}>
              <o.Icon size={28} color={form.page_public === o.v ? 'var(--red)' : 'var(--gray-text)'} />
              <span style={{ fontWeight: 700 }}>{o.label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-text)' }}>{o.desc}</span>
            </Choice>
          ))}
        </div>
      ) },
  ]

  const cur = steps[step]
  const isLast = step === steps.length - 1

  // Optional fields skipped or left blank are sent as null, not empty strings.
  const finalize = f => ({
    ...f,
    why_now: f.why_now?.trim() ? f.why_now : null,
    past_blockers: f.past_blockers?.trim() ? f.past_blockers : null,
    daily_rhythm: f.daily_rhythm || null,
    hours_per_day: f.hours_per_day || null,
  })

  const advance = (fromKey) => {
    if (fromKey && cur.key !== fromKey) return
    setLocalErr('')
    if (!cur.valid()) { setLocalErr('Please complete this step.'); return }
    if (isLast) { onSubmit(finalize(form)); return }
    setDir(1); setStep(s => s + 1)
  }
  const back = () => { setLocalErr(''); setDir(-1); setStep(s => Math.max(0, s - 1)) }
  // Skip an optional step: clear its field and move on.
  const skip = () => {
    setLocalErr('')
    if (cur.key) set(cur.key, '')
    if (isLast) { onSubmit(finalize(form)); return }
    setDir(1); setStep(s => s + 1)
  }
  // The goal chat owns its own input + approval; on approval set the refined goal and advance.
  const approveGoal = refinedGoal => {
    setForm(f => ({ ...f, goals: refinedGoal }))
    setLocalErr(''); setDir(1); setStep(s => s + 1)
  }
  // Life-area step: lock in the area (+ optional starter goal) and move to the chat.
  const pickGoal = (area, goal) => {
    setForm(f => ({ ...f, life_area: area, goals: goal }))
    setLocalErr(''); setDir(1); setStep(s => s + 1)
  }
  const goNext = () => { setLocalErr(''); setFeas(null); setDir(1); setStep(s => s + 1) }
  // Cadence step: ongoing habits skip the timeline check; timed goals get a feasibility check.
  const cadenceContinue = async () => {
    if (form.goal_type === 'lifestyle') { goNext(); return }
    if (form.duration_days < 1) { setLocalErr('Set a number of days for this goal.'); return }
    setFeasBusy(true); setLocalErr('')
    try {
      const r = await api.validateGoal({ goal: form.goals, duration_days: Number(form.duration_days), goal_type: 'sprint' })
      if (r && r.feasible === false && r.message) { setFeas(r); return }
      if (r?.recommended_days) setForm(f => ({ ...f, ai_recommended_days: r.recommended_days }))
      goNext()
    } catch (e) { goNext() }  // never block onboarding on a validation failure
    finally { setFeasBusy(false) }
  }
  const acceptRecommendation = () => {
    setForm(f => ({ ...f, duration_days: feas.recommended_days, ai_recommended_days: feas.recommended_days }))
    goNext()
  }
  const keepTimeline = () => {
    setForm(f => ({ ...f, ai_recommended_days: feas.recommended_days }))
    goNext()
  }
  const onKey = e => {
    if (cur.chat || cur.custom) return  // these steps manage their own input
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); advance() }
    else if (e.key === 'Enter' && !e.shiftKey && !cur.text) { e.preventDefault(); advance() }
  }

  if (busy) {
    return (
      <div style={St.generating}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <h2 className="h-lg display" style={{ marginTop: 28 }}>{addMode ? 'Building your goal' : 'Forging your plan'}</h2>
          <p className="lead" style={{ marginTop: 10 }}>Designing your tasks, identity, and Day 1 signal.</p>
        </motion.div>
      </div>
    )
  }

  const bg = STEP_BG[cur.key]
  return (
    <div style={St.wrap} onKeyDown={onKey}>
      {bg && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bg})`, backgroundSize: 'cover',
        backgroundPosition: 'center', opacity: 0.05, pointerEvents: 'none', zIndex: 0, borderRadius: 'inherit' }} />}

      {/* Segmented progress: solid = required, dashed/hollow = optional */}
      <div style={St.progressTrack}>
        {steps.map((s, i) => {
          const reached = i <= step
          return (
            <motion.div key={s.key} initial={false}
              animate={{ background: reached ? 'var(--black)' : (s.optional ? 'transparent' : 'var(--gray-line)') }}
              transition={{ duration: 0.4 }}
              style={{ flex: 1, height: '100%', borderRadius: 2,
                border: !reached && s.optional ? '1px dashed var(--gray-line)' : 'none' }} />
          )
        })}
      </div>

      <div style={St.shell}>
        <div style={St.top}>
          <span style={St.logo}>{addMode ? 'NEW GOAL' : 'STRYKD'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {cur.optional && <span style={St.optChip}>Optional</span>}
            <span style={{ color: 'var(--gray-text)', fontSize: '0.9rem', fontWeight: 500 }}>Step {step + 1} of {steps.length}</span>
            {addMode && onClose && <button onClick={onClose} style={St.close} aria-label="Close"><X size={18} /></button>}
          </span>
        </div>

        <div style={St.stepWrap}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit" style={{ width: '100%' }}>
              <h1 className="h-xl display" style={{ marginBottom: 12 }}>{cur.q}</h1>
              <p className="lead" style={{ marginBottom: (cur.chat || cur.custom) ? 20 : 36 }}>{cur.sub}</p>
              {cur.render()}
              {(localErr || error) && <p style={St.err}>{localErr || error}</p>}
              {!cur.chat && !cur.custom && (
                <>
                  <div style={St.nav}>
                    {step > 0 && <button className="pill pill-outline pill-sm" onClick={back}><ArrowLeft size={15} /> Back</button>}
                    <button className="pill pill-dark" onClick={() => advance()} style={{ marginLeft: 'auto' }}>
                      {isLast ? (addMode ? 'Create this goal' : 'Start your free trial') : 'Continue'} <ArrowRight size={17} />
                    </button>
                  </div>
                  {cur.optional && (
                    <button type="button" onClick={skip} style={St.skip}>Skip for now</button>
                  )}
                </>
              )}
              {/* Back link for chat/custom steps (they advance via their own buttons) */}
              {(cur.chat || cur.custom) && step > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button className="pill pill-outline pill-sm" onClick={back}><ArrowLeft size={15} /> Back</button>
                </div>
              )}
              {isLast && !addMode && <p style={St.trial}>30 days free. No card needed.</p>}
              {cur.text && <p style={St.hint}>Press Cmd/Ctrl + Enter to continue</p>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Choice({ active, children, style, onClick }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.98 }}
      style={{ display: 'flex', padding: '1.1rem 1.2rem', background: active ? 'rgba(255,45,45,0.04)' : 'var(--white)',
        color: 'var(--ink)', border: `1.5px solid ${active ? 'var(--red)' : 'var(--gray-line)'}`,
        borderRadius: 16, transition: 'border-color 0.18s, background 0.18s', cursor: 'pointer', ...style }}>
      {children}
    </motion.button>
  )
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--gray-light)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>{label}</label>
      {children}
    </div>
  )
}

const St = {
  wrap: { position: 'relative', width: '100%', minHeight: 'inherit', display: 'flex', flexDirection: 'column' },
  generating: { minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, display: 'flex', gap: 4, padding: '0 2px', zIndex: 10 },
  skip: { display: 'block', margin: '14px 0 0 auto', background: 'none', border: 'none', color: 'var(--gray-text)',
    fontSize: '0.85rem', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' },
  optChip: { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gray-text)',
    background: 'var(--gray-section)', border: '1px solid var(--gray-line)', borderRadius: 50, padding: '4px 10px', textTransform: 'uppercase' },
  shell: { flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  logo: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '0.95rem' },
  close: { background: 'transparent', border: 'none', color: 'var(--gray-text)', display: 'grid', placeItems: 'center', padding: 2 },
  stepWrap: { flex: 1, display: 'flex', alignItems: 'flex-start' },
  textarea: { minHeight: 140, resize: 'vertical', lineHeight: 1.5 },
  themeCard: { background: 'var(--white)', border: '1.5px solid var(--gray-line)', borderRadius: 16, padding: 12, cursor: 'pointer', transition: 'all 0.18s' },
  err: { color: 'var(--red)', fontSize: '0.9rem', marginTop: 16 },
  nav: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 36 },
  trial: { color: 'var(--gray-text)', fontSize: '0.84rem', marginTop: 14, textAlign: 'right' },
  hint: { color: 'var(--gray-light)', fontSize: '0.78rem', marginTop: 14 },
  areaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 10 },
  areaCard: { position: 'relative', height: 92, borderRadius: 14, overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0, background: '#000' },
  areaImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  areaShade: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.15))' },
  areaLabel: { position: 'absolute', left: 10, bottom: 9, right: 8, display: 'flex', alignItems: 'center', gap: 6,
    color: '#fff', fontWeight: 700, fontSize: '0.8rem', textAlign: 'left', lineHeight: 1.15 },
  recEyebrow: { fontSize: '0.7rem', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--gray-light)' },
  recCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
    textAlign: 'left', padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--gray-line)',
    background: 'var(--white)', color: 'var(--ink)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' },
  recOwn: { display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 2,
    padding: '10px 4px', background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' },
  feasBox: { background: 'rgba(255,45,45,0.05)', border: '1px solid rgba(255,45,45,0.3)', borderRadius: 14, padding: 16,
    color: 'var(--ink)', fontSize: '0.95rem' },
}
