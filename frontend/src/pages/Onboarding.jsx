import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'

const AESTHETICS = [
  { id: 'dark-ember', label: 'Dark Ember', desc: 'Bold, intense, fire-forged', swatch: '#E85D04', bg: '#0D0805' },
  { id: 'arctic-focus', label: 'Arctic Focus', desc: 'Clean, sharp, clinical', swatch: '#0EA5E9', bg: '#FFFFFF' },
  { id: 'soft-earth', label: 'Soft Earth', desc: 'Warm, grounded, organic', swatch: '#C2714F', bg: '#F5F0E8' },
]
const LIFE_AREAS = [
  { id: 'career', label: 'Career', icon: '📈' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'business', label: 'Business', icon: '🚀' },
  { id: 'creative', label: 'Creative', icon: '🎨' },
  { id: 'personal-growth', label: 'Personal Growth', icon: '🌱' },
]

// Theme constants (onboarding is always shown in the brand's ember theme)
const C = {
  bg: '#0D0805', card: '#1A100A', cardActive: '#261508',
  fg: '#F5F0EB', dim: '#A89080', border: '#3D1F10', accent: '#E85D04',
}

export default function Onboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1) // 1 forward, -1 back (drives slide direction)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    goals: '', life_area: '', why_now: '', past_blockers: '',
    duration_days: 7, hours_per_day: 2, daily_rhythm: '',
    aesthetic: '', page_public: true,
  })

  useEffect(() => { if (!getToken()) nav('/') }, [nav])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const steps = [
    {
      key: 'goals', q: 'What do you want to achieve?',
      sub: 'Be ambitious. The AI builds the path.',
      valid: () => form.goals.trim().length > 3,
      render: () => (
        <textarea autoFocus className="card" style={S.textarea}
          placeholder="e.g. Launch my freelance studio and land 3 paying clients…"
          value={form.goals} onChange={e => set('goals', e.target.value)} />
      ),
    },
    {
      key: 'life_area', q: 'Which part of your life?',
      sub: 'This shapes the tone and structure of your plan.',
      valid: () => !!form.life_area,
      render: () => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {LIFE_AREAS.map((a, i) => (
            <button type="button" key={a.id} onClick={() => { set('life_area', a.id); next() }}
              className={`choice anim-up d${i + 1}`}
              style={{ ...S.choice, ...(form.life_area === a.id ? S.choiceActive : {}),
                flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem',
                gridColumn: a.id === 'personal-growth' ? 'span 2' : 'auto' }}>
              <span style={{ fontSize: '1.6rem' }}>{a.icon}</span>
              <span style={{ fontWeight: 700 }}>{a.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'why_now', q: 'Why now?',
      sub: "What's the urgency? This becomes the fuel in your plan.",
      valid: () => form.why_now.trim().length > 3,
      render: () => (
        <textarea autoFocus className="card" style={S.textarea}
          placeholder="What makes this the moment? What's at stake?"
          value={form.why_now} onChange={e => set('why_now', e.target.value)} />
      ),
    },
    {
      key: 'past_blockers', q: 'What has stopped you before?',
      sub: 'Be honest. The AI designs tasks to defuse these exact failure modes.',
      valid: () => form.past_blockers.trim().length > 3,
      render: () => (
        <textarea autoFocus className="card" style={S.textarea}
          placeholder="e.g. I start strong then get paralyzed by perfectionism…"
          value={form.past_blockers} onChange={e => set('past_blockers', e.target.value)} />
      ),
    },
    {
      key: 'cadence', q: 'How much can you commit?',
      sub: 'Your plan is sized to fit — no impossible schedules.',
      valid: () => form.duration_days >= 1 && form.hours_per_day >= 1,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Field label="OVER HOW MANY DAYS?">
            <input autoFocus type="number" min={1} max={365} className="card" style={S.input}
              value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))} />
          </Field>
          <Field label="FOCUSED HOURS PER DAY?">
            <input type="number" min={1} max={16} className="card" style={S.input}
              value={form.hours_per_day} onChange={e => set('hours_per_day', Number(e.target.value))} />
          </Field>
        </div>
      ),
    },
    {
      key: 'daily_rhythm', q: 'When are you sharpest?',
      sub: 'The heaviest work gets scheduled into your peak window.',
      valid: () => !!form.daily_rhythm,
      render: () => (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[{ id: 'morning', icon: '🌅', label: 'Morning' }, { id: 'evening', icon: '🌙', label: 'Evening' }].map((r, i) => (
            <button type="button" key={r.id} onClick={() => { set('daily_rhythm', r.id); next() }}
              className={`choice anim-up d${i + 1}`}
              style={{ ...S.choice, ...(form.daily_rhythm === r.id ? S.choiceActive : {}),
                flex: 1, flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '2rem 1rem' }}>
              <span style={{ fontSize: '2.2rem' }}>{r.icon}</span>
              <span style={{ fontWeight: 700 }}>{r.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'aesthetic', q: 'Pick your visual identity.',
      sub: 'This is how your live page will look to the world.',
      valid: () => !!form.aesthetic,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {AESTHETICS.map((a, i) => (
            <button type="button" key={a.id} onClick={() => { set('aesthetic', a.id); next() }}
              className={`choice anim-up d${i + 1}`}
              style={{ ...S.choice, ...(form.aesthetic === a.id ? S.choiceActive : {}),
                alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: a.swatch,
                flexShrink: 0, border: `3px solid ${a.bg}` }} />
              <span style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                <span style={{ display: 'block', fontSize: '0.82rem', color: C.dim }}>{a.desc}</span>
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'page_public', q: 'Who can see your page?',
      sub: 'Public pages live at your subdomain and are shareable.',
      valid: () => true,
      render: () => (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[{ v: true, icon: '🌍', label: 'Public', desc: 'Shareable, on your subdomain' },
            { v: false, icon: '🔒', label: 'Private', desc: 'Only you, on your dashboard' }].map((o, i) => (
            <button type="button" key={String(o.v)} onClick={() => set('page_public', o.v)}
              className={`choice anim-up d${i + 1}`}
              style={{ ...S.choice, ...(form.page_public === o.v ? S.choiceActive : {}),
                flex: 1, flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.75rem 1rem' }}>
              <span style={{ fontSize: '2rem' }}>{o.icon}</span>
              <span style={{ fontWeight: 700 }}>{o.label}</span>
              <span style={{ fontSize: '0.76rem', color: C.dim, textAlign: 'center' }}>{o.desc}</span>
            </button>
          ))}
        </div>
      ),
    },
  ]

  const cur = steps[step]
  const isLast = step === steps.length - 1
  const progress = ((step + 1) / steps.length) * 100

  const next = () => {
    setError('')
    if (!cur.valid()) { setError('Please complete this step.'); return }
    if (isLast) { submit(); return }
    setDir(1); setStep(s => s + 1)
  }
  const back = () => { setError(''); setDir(-1); setStep(s => Math.max(0, s - 1)) }

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await api.onboard({
        ...form,
        duration_days: Number(form.duration_days),
        hours_per_day: Number(form.hours_per_day),
      })
      nav('/dashboard')
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  const onKey = e => {
    // Enter advances (Shift+Enter allowed inside textareas for newlines)
    if (e.key === 'Enter' && !e.shiftKey && cur.key !== 'goals' && cur.key !== 'why_now' && cur.key !== 'past_blockers') {
      e.preventDefault(); next()
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); next() }
  }

  if (busy) return <Generating />

  return (
    <div style={S.page} onKeyDown={onKey}>
      {/* Progress bar */}
      <div style={S.progressTrack}>
        <div className="progress-fill" style={{ ...S.progressFill, width: `${progress}%` }} />
      </div>

      <div style={S.shell}>
        <div style={S.topRow}>
          <span style={S.brand}>STRYKD</span>
          <span style={{ color: C.dim, fontSize: '0.8rem' }}>
            {step + 1} / {steps.length}
          </span>
        </div>

        {/* Animated question block — re-keyed per step so it re-animates */}
        <div key={step} style={S.qBlock} className={dir > 0 ? 'anim-slide' : 'anim-up'}>
          <h1 style={S.question}>{cur.q}</h1>
          <p style={S.subtext}>{cur.sub}</p>
          <div style={{ marginTop: '2rem' }}>{cur.render()}</div>

          {error && <p style={S.error}>{error}</p>}

          <div style={S.nav}>
            {step > 0 && (
              <button type="button" onClick={back} style={S.backBtn}>← Back</button>
            )}
            <button type="button" onClick={next} className="btn-primary"
              style={{ ...S.nextBtn, marginLeft: 'auto' }}>
              {isLast ? 'Launch my plan →' : 'Continue →'}
            </button>
          </div>

          {(cur.key === 'goals' || cur.key === 'why_now' || cur.key === 'past_blockers') && (
            <p style={S.hint}>Press ⌘/Ctrl + Enter to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', color: C.dim, fontWeight: 700,
        letterSpacing: '0.06em', marginBottom: '0.6rem' }}>{label}</label>
      {children}
    </div>
  )
}

function Generating() {
  return (
    <div style={{ ...S.page, justifyContent: 'center' }}>
      <div className="anim-scale" style={{ textAlign: 'center' }}>
        <div style={S.spinner} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2rem' }}>
          Forging your plan…
        </h2>
        <p style={{ color: C.dim, marginTop: '0.5rem' }}>
          The AI is designing your tasks, theme, and Day 1 signal.
        </p>
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: C.bg, color: C.fg,
    display: 'flex', flexDirection: 'column', position: 'relative',
  },
  progressTrack: {
    position: 'fixed', top: 0, left: 0, right: 0, height: 3,
    background: C.border, zIndex: 10,
  },
  progressFill: { height: '100%', background: C.accent },
  shell: {
    flex: 1, width: '100%', maxWidth: 560, margin: '0 auto',
    padding: '3.5rem 1.5rem', display: 'flex', flexDirection: 'column',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' },
  brand: { fontSize: '0.85rem', letterSpacing: '0.18em', fontWeight: 700, color: C.dim },
  qBlock: { flex: 1 },
  question: { fontSize: 'clamp(1.6rem, 5vw, 2.3rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em' },
  subtext: { color: C.dim, fontSize: '1rem', marginTop: '0.75rem', lineHeight: 1.5 },
  textarea: {
    width: '100%', minHeight: 140, padding: '1rem 1.2rem', background: C.card,
    color: C.fg, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: '1.05rem',
    lineHeight: 1.5, resize: 'vertical', outline: 'none',
  },
  input: {
    width: '100%', padding: '1rem 1.2rem', background: C.card, color: C.fg,
    border: `1px solid ${C.border}`, borderRadius: 12, fontSize: '1.1rem', outline: 'none',
  },
  choice: {
    display: 'flex', padding: '1.1rem 1.2rem', background: C.card, color: C.fg,
    border: `2px solid ${C.border}`, borderRadius: 12,
  },
  choiceActive: { background: C.cardActive, borderColor: C.accent },
  error: { color: C.accent, fontSize: '0.88rem', marginTop: '1rem' },
  nav: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' },
  backBtn: { background: 'none', border: 'none', color: C.dim, fontWeight: 600, fontSize: '0.92rem' },
  nextBtn: { padding: '0.9rem 1.8rem', fontSize: '0.98rem' },
  hint: { color: C.dim, fontSize: '0.78rem', marginTop: '1rem', opacity: 0.7 },
  spinner: {
    width: 48, height: 48, margin: '0 auto', borderRadius: '50%',
    border: `3px solid ${C.border}`, borderTopColor: C.accent,
    animation: 'spin 0.8s linear infinite',
  },
}

// inject the spinner keyframe (styles.css covers the rest)
if (typeof document !== 'undefined' && !document.getElementById('onb-spin')) {
  const st = document.createElement('style')
  st.id = 'onb-spin'
  st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(st)
}
