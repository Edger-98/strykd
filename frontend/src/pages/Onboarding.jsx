import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Briefcase, Dumbbell, Rocket, Palette, Sprout,
  Sunrise, Moon, Globe, Lock, Loader2, Check,
} from 'lucide-react'
import GridBackground from '../components/GridBackground'
import { api, getToken } from '../api'

const LIFE_AREAS = [
  { id: 'career', label: 'Career', Icon: Briefcase },
  { id: 'fitness', label: 'Fitness', Icon: Dumbbell },
  { id: 'business', label: 'Business', Icon: Rocket },
  { id: 'creative', label: 'Creative', Icon: Palette },
  { id: 'personal-growth', label: 'Personal Growth', Icon: Sprout },
]
const AESTHETICS = [
  { id: 'dark-ember', label: 'Dark Ember', desc: 'Bold, intense, fire-forged', c: '#FF2D2D' },
  { id: 'arctic-focus', label: 'Arctic Focus', desc: 'Clean, sharp, clinical', c: '#00D4FF' },
  { id: 'soft-earth', label: 'Soft Earth', desc: 'Warm, grounded, organic', c: '#C2714F' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
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
      key: 'goals', q: 'What do you want to achieve?', sub: 'Be ambitious. The AI builds the path.',
      valid: () => form.goals.trim().length > 3, text: true,
      render: () => (
        <textarea autoFocus className="field" style={S.textarea}
          placeholder="e.g. Launch my freelance studio and land 3 paying clients…"
          value={form.goals} onChange={e => set('goals', e.target.value)} />
      ),
    },
    {
      key: 'life_area', q: 'Which part of your life?', sub: 'This shapes the structure of your plan.',
      valid: () => !!form.life_area,
      render: () => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {LIFE_AREAS.map((a, i) => (
            <Choice key={a.id} active={form.life_area === a.id} onClick={() => { set('life_area', a.id); advance() }}
              className={`anim-up d${i + 1}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem',
                gridColumn: a.id === 'personal-growth' ? 'span 2' : 'auto' }}>
              <a.Icon size={24} color={form.life_area === a.id ? 'var(--red)' : 'var(--text-dim)'} />
              <span style={{ fontWeight: 700 }}>{a.label}</span>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      key: 'why_now', q: 'Why now?', sub: "What's the urgency? This becomes the fuel.",
      valid: () => form.why_now.trim().length > 3, text: true,
      render: () => (
        <textarea autoFocus className="field" style={S.textarea}
          placeholder="What makes this the moment? What's at stake?"
          value={form.why_now} onChange={e => set('why_now', e.target.value)} />
      ),
    },
    {
      key: 'past_blockers', q: 'What has stopped you before?', sub: 'The AI designs tasks to defuse these exact failure modes.',
      valid: () => form.past_blockers.trim().length > 3, text: true,
      render: () => (
        <textarea autoFocus className="field" style={S.textarea}
          placeholder="e.g. I start strong then get paralyzed by perfectionism…"
          value={form.past_blockers} onChange={e => set('past_blockers', e.target.value)} />
      ),
    },
    {
      key: 'cadence', q: 'How much can you commit?', sub: 'Your plan is sized to fit — no impossible schedules.',
      valid: () => form.duration_days >= 1 && form.hours_per_day >= 1,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Field label="OVER HOW MANY DAYS?">
            <input autoFocus type="number" min={1} max={365} className="field"
              value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))} />
          </Field>
          <Field label="FOCUSED HOURS PER DAY?">
            <input type="number" min={1} max={16} className="field"
              value={form.hours_per_day} onChange={e => set('hours_per_day', Number(e.target.value))} />
          </Field>
        </div>
      ),
    },
    {
      key: 'daily_rhythm', q: 'When are you sharpest?', sub: 'The heaviest work goes into your peak window.',
      valid: () => !!form.daily_rhythm,
      render: () => (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[{ id: 'morning', Icon: Sunrise, label: 'Morning' }, { id: 'evening', Icon: Moon, label: 'Evening' }].map((r, i) => (
            <Choice key={r.id} active={form.daily_rhythm === r.id} onClick={() => { set('daily_rhythm', r.id); advance() }}
              className={`anim-up d${i + 1}`} style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 1rem' }}>
              <r.Icon size={32} color={form.daily_rhythm === r.id ? 'var(--red)' : 'var(--text-dim)'} />
              <span style={{ fontWeight: 700 }}>{r.label}</span>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      key: 'aesthetic', q: 'Pick your visual identity.', sub: 'How your live page introduces you.',
      valid: () => !!form.aesthetic,
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {AESTHETICS.map((a, i) => (
            <Choice key={a.id} active={form.aesthetic === a.id} onClick={() => { set('aesthetic', a.id); advance() }}
              className={`anim-up d${i + 1}`} style={{ alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: a.c, flexShrink: 0 }} />
              <span style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)' }}>{a.desc}</span>
              </span>
            </Choice>
          ))}
        </div>
      ),
    },
    {
      key: 'page_public', q: 'Who can see your page?', sub: 'Public pages live on your subdomain and are shareable.',
      valid: () => true,
      render: () => (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[{ v: true, Icon: Globe, label: 'Public', desc: 'Shareable, on your subdomain' },
            { v: false, Icon: Lock, label: 'Private', desc: 'Only you, on your dashboard' }].map((o, i) => (
            <Choice key={String(o.v)} active={form.page_public === o.v} onClick={() => set('page_public', o.v)}
              className={`anim-up d${i + 1}`} style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: '0.65rem', padding: '1.75rem 1rem' }}>
              <o.Icon size={28} color={form.page_public === o.v ? 'var(--red)' : 'var(--text-dim)'} />
              <span style={{ fontWeight: 700 }}>{o.label}</span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', textAlign: 'center' }}>{o.desc}</span>
            </Choice>
          ))}
        </div>
      ),
    },
  ]

  const cur = steps[step]
  const isLast = step === steps.length - 1
  const progress = ((step + 1) / steps.length) * 100

  const advance = () => {
    setError('')
    if (!cur.valid()) { setError('Please complete this step.'); return }
    if (isLast) { submit(); return }
    setStep(s => s + 1)
  }
  const back = () => { setError(''); setStep(s => Math.max(0, s - 1)) }

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await api.onboard({ ...form, duration_days: Number(form.duration_days), hours_per_day: Number(form.hours_per_day) })
      nav('/dashboard')
    } catch (err) { setError(err.message); setBusy(false) }
  }

  const onKey = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); advance() }
    else if (e.key === 'Enter' && !e.shiftKey && !cur.text) { e.preventDefault(); advance() }
  }

  if (busy) return <Generating />

  return (
    <div style={S.page} onKeyDown={onKey}>
      {/* Red progress bar */}
      <div style={S.progressTrack}>
        <div className="progress-fill" style={{ height: '100%', background: 'var(--red)', width: `${progress}%` }} />
      </div>

      <div style={S.shell}>
        <div style={S.top}>
          <span style={S.brand}>STRYKD</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
            {String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </span>
        </div>

        <div key={step} className="anim-slide" style={{ flex: 1 }}>
          <h1 className="display h-xl" style={{ marginBottom: '0.75rem' }}>{cur.q}</h1>
          <p style={S.sub}>{cur.sub}</p>
          <div style={{ marginTop: '2.25rem' }}>{cur.render()}</div>

          {error && <p style={S.err}>{error}</p>}

          <div style={S.nav}>
            {step > 0 && (
              <button className="pill pill-outline pill-sm" onClick={back}>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <button className="pill pill-red" onClick={advance} style={{ marginLeft: 'auto' }}>
              {isLast ? 'Launch my plan' : 'Continue'} <ArrowRight size={17} />
            </button>
          </div>

          {cur.text && <p style={S.hint}>Press ⌘/Ctrl + Enter to continue</p>}
        </div>
      </div>
    </div>
  )
}

function Choice({ active, children, style, className, onClick }) {
  return (
    <button type="button" onClick={onClick} className={className}
      style={{
        display: 'flex', padding: '1.1rem 1.2rem', background: active ? 'rgba(255,45,45,0.06)' : 'var(--surface)',
        color: 'var(--white)', border: `1px solid ${active ? 'var(--red)' : 'var(--line)'}`,
        borderRadius: 14, transition: 'all 0.18s var(--ease-out)', ...style,
      }}>
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700,
        letterSpacing: '0.1em', marginBottom: '0.6rem' }}>{label}</label>
      {children}
    </div>
  )
}

function Generating() {
  return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center' }}>
      <GridBackground wash="red" markers={false} />
      <div className="anim-scale" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <h2 className="display h-lg" style={{ marginTop: '2rem' }}>Forging your plan</h2>
        <p style={{ color: 'var(--text-dim)', marginTop: '0.75rem' }}>
          Designing your tasks, identity, and Day 1 signal.
        </p>
      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--black)', color: 'var(--white)', display: 'flex', flexDirection: 'column', position: 'relative' },
  progressTrack: { position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'var(--line)', zIndex: 10 },
  shell: { flex: 1, width: '100%', maxWidth: 580, margin: '0 auto', padding: '3.5rem 1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' },
  brand: { fontWeight: 800, letterSpacing: '0.14em', fontSize: '0.9rem', color: 'var(--text-dim)' },
  sub: { color: 'var(--text-dim)', fontSize: '1.05rem', lineHeight: 1.5 },
  textarea: { minHeight: 140, resize: 'vertical', lineHeight: 1.5 },
  err: { color: 'var(--red)', fontSize: '0.88rem', marginTop: '1rem' },
  nav: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' },
  hint: { color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1rem' },
}
