import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Briefcase, Dumbbell, Rocket, Palette, Sprout,
  Sunrise, Moon, Globe, Lock, X,
} from 'lucide-react'
import { stepVariants } from '../motion'

const STEP_BG = {
  goals: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1440&q=80',
  life_area: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1440&q=80',
}
const LIFE_AREAS = [
  { id: 'career', label: 'Career', Icon: Briefcase },
  { id: 'fitness', label: 'Fitness', Icon: Dumbbell },
  { id: 'business', label: 'Business', Icon: Rocket },
  { id: 'creative', label: 'Creative', Icon: Palette },
  { id: 'personal-growth', label: 'Personal Growth', Icon: Sprout },
]
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
    aesthetic: '', page_public: true,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addMode = mode === 'add'

  const steps = [
    { key: 'goals', q: 'What do you want to achieve?', sub: 'Be ambitious. The AI builds the path.',
      valid: () => form.goals.trim().length > 3, text: true,
      render: () => <textarea autoFocus className="field" style={St.textarea}
        placeholder="e.g. Launch my freelance studio and land 3 paying clients" value={form.goals} onChange={e => set('goals', e.target.value)} /> },
    { key: 'life_area', q: 'Which part of your life?', sub: 'This shapes the structure of your plan.',
      valid: () => !!form.life_area,
      render: () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {LIFE_AREAS.map(a => (
            <Choice key={a.id} active={form.life_area === a.id} onClick={() => { set('life_area', a.id); advance('life_area') }}
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <a.Icon size={24} color={form.life_area === a.id ? 'var(--red)' : 'var(--gray-text)'} />
              <span style={{ fontWeight: 700 }}>{a.label}</span>
            </Choice>
          ))}
        </div>
      ) },
    { key: 'why_now', q: 'Why now?', sub: "What's the urgency? This becomes the fuel.",
      valid: () => form.why_now.trim().length > 3, text: true,
      render: () => <textarea autoFocus className="field" style={St.textarea}
        placeholder="What makes this the moment? What's at stake?" value={form.why_now} onChange={e => set('why_now', e.target.value)} /> },
    { key: 'past_blockers', q: 'What has stopped you before?', sub: 'The AI designs tasks to defuse these exact failure modes.',
      valid: () => form.past_blockers.trim().length > 3, text: true,
      render: () => <textarea autoFocus className="field" style={St.textarea}
        placeholder="e.g. I start strong then get paralyzed by perfectionism" value={form.past_blockers} onChange={e => set('past_blockers', e.target.value)} /> },
    { key: 'cadence', q: 'How much can you commit?', sub: 'Your plan is sized to fit. No impossible schedules.',
      valid: () => form.duration_days >= 1 && form.hours_per_day >= 1,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="OVER HOW MANY DAYS?"><input autoFocus type="number" min={1} max={365} className="field"
            value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))} /></Field>
          <Field label="FOCUSED HOURS PER DAY?"><input type="number" min={1} max={16} className="field"
            value={form.hours_per_day} onChange={e => set('hours_per_day', Number(e.target.value))} /></Field>
        </div>
      ) },
    { key: 'daily_rhythm', q: 'When are you sharpest?', sub: 'The heaviest work goes into your peak window.',
      valid: () => !!form.daily_rhythm,
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
              <div style={{ background: a.bg, borderRadius: 10, padding: 12, marginBottom: 12, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
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
  const progress = ((step + 1) / steps.length) * 100

  const advance = (fromKey) => {
    if (fromKey && cur.key !== fromKey) return
    setLocalErr('')
    if (!cur.valid()) { setLocalErr('Please complete this step.'); return }
    if (isLast) { onSubmit(form); return }
    setDir(1); setStep(s => s + 1)
  }
  const back = () => { setLocalErr(''); setDir(-1); setStep(s => Math.max(0, s - 1)) }
  const onKey = e => {
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

      <div style={St.progressTrack}>
        <motion.div style={St.progressFill} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </div>

      <div style={St.shell}>
        <div style={St.top}>
          <span style={St.logo}>{addMode ? 'NEW GOAL' : 'STRYKD'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: 'var(--gray-text)', fontSize: '0.9rem', fontWeight: 500 }}>Step {step + 1} of {steps.length}</span>
            {addMode && onClose && <button onClick={onClose} style={St.close} aria-label="Close"><X size={18} /></button>}
          </span>
        </div>

        <div style={St.stepWrap}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit" style={{ width: '100%' }}>
              <h1 className="h-xl display" style={{ marginBottom: 12 }}>{cur.q}</h1>
              <p className="lead" style={{ marginBottom: 36 }}>{cur.sub}</p>
              {cur.render()}
              {(localErr || error) && <p style={St.err}>{localErr || error}</p>}
              <div style={St.nav}>
                {step > 0 && <button className="pill pill-outline pill-sm" onClick={back}><ArrowLeft size={15} /> Back</button>}
                <button className="pill pill-dark" onClick={() => advance()} style={{ marginLeft: 'auto' }}>
                  {isLast ? (addMode ? 'Create this goal' : 'Start your free week') : 'Continue'} <ArrowRight size={17} />
                </button>
              </div>
              {isLast && !addMode && <p style={St.trial}>No charge for 7 days. Cancel anytime.</p>}
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
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gray-line)', zIndex: 10, borderRadius: '16px 16px 0 0' },
  progressFill: { height: '100%', background: 'var(--black)' },
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
}
