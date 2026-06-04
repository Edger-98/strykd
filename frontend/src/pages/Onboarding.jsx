import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'

const AESTHETICS = [
  { id: 'dark-ember', label: 'Dark Ember', desc: 'Bold, intense, fire-forged', swatch: '#E85D04', bg: '#0D0805' },
  { id: 'arctic-focus', label: 'Arctic Focus', desc: 'Clean, sharp, clinical', swatch: '#0EA5E9', bg: '#FFFFFF' },
  { id: 'soft-earth', label: 'Soft Earth', desc: 'Warm, grounded, organic', swatch: '#C2714F', bg: '#F5F0E8' },
]

const LIFE_AREAS = ['career', 'fitness', 'business', 'creative', 'personal-growth']

export default function Onboarding() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    goals: '', duration_days: 7, aesthetic: 'dark-ember',
    life_area: 'career', why_now: '', past_blockers: '',
    hours_per_day: 2, daily_rhythm: 'morning', page_public: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!getToken()) nav('/') }, [nav])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.onboard({
        ...form,
        duration_days: Number(form.duration_days),
        hours_per_day: Number(form.hours_per_day),
      })
      nav('/dashboard')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const input = {
    width: '100%', padding: '0.85rem 1rem',
    background: '#1A100A', color: '#F5F0EB',
    border: '1px solid #3D1F10', borderRadius: 8, fontSize: '0.95rem', outline: 'none',
  }
  const label = { display: 'block', fontSize: '0.85rem', color: '#A89080', marginBottom: '0.5rem', fontWeight: 600 }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0805', color: '#F5F0EB', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Set your trajectory</h1>
        <p style={{ color: '#A89080', marginBottom: '2.5rem' }}>
          The more honest you are, the more personal your plan.
        </p>

        <form onSubmit={submit}>
          <label style={label}>WHAT ARE YOUR GOALS?</label>
          <textarea
            style={{ ...input, minHeight: 100, resize: 'vertical', marginBottom: '1.5rem' }}
            placeholder="Describe what you want to achieve…"
            value={form.goals} onChange={e => set('goals', e.target.value)} required
          />

          <label style={label}>LIFE AREA</label>
          <select style={{ ...input, marginBottom: '1.5rem' }} value={form.life_area}
                  onChange={e => set('life_area', e.target.value)}>
            {LIFE_AREAS.map(a => <option key={a} value={a}>{a.replace('-', ' ')}</option>)}
          </select>

          <label style={label}>WHY NOW? WHAT'S THE URGENCY?</label>
          <textarea
            style={{ ...input, minHeight: 80, resize: 'vertical', marginBottom: '1.5rem' }}
            placeholder="What makes this the moment?"
            value={form.why_now} onChange={e => set('why_now', e.target.value)} required
          />

          <label style={label}>WHAT HAS BLOCKED YOU BEFORE?</label>
          <textarea
            style={{ ...input, minHeight: 80, resize: 'vertical', marginBottom: '1.5rem' }}
            placeholder="Be specific about your past failure modes…"
            value={form.past_blockers} onChange={e => set('past_blockers', e.target.value)} required
          />

          <label style={label}>TIME FRAME (DAYS)</label>
          <input style={{ ...input, marginBottom: '1.5rem' }} type="number" min={1} max={365}
                 value={form.duration_days} onChange={e => set('duration_days', e.target.value)} required />

          <label style={label}>FOCUSED HOURS PER DAY</label>
          <input style={{ ...input, marginBottom: '1.5rem' }} type="number" min={1} max={16}
                 value={form.hours_per_day} onChange={e => set('hours_per_day', e.target.value)} required />

          <label style={label}>WHEN DO YOU OPERATE BEST?</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['morning', 'evening'].map(r => (
              <button type="button" key={r} onClick={() => set('daily_rhythm', r)}
                style={{ flex: 1, padding: '0.85rem', borderRadius: 8, fontWeight: 600,
                  background: form.daily_rhythm === r ? '#261508' : '#1A100A', color: '#F5F0EB',
                  border: `2px solid ${form.daily_rhythm === r ? '#E85D04' : '#3D1F10'}` }}>
                {r === 'morning' ? '🌅 Morning' : '🌙 Evening'}
              </button>
            ))}
          </div>

          <label style={label}>CHOOSE YOUR AESTHETIC</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {AESTHETICS.map(a => (
              <button type="button" key={a.id} onClick={() => set('aesthetic', a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', textAlign: 'left',
                  background: form.aesthetic === a.id ? '#261508' : '#1A100A',
                  border: `2px solid ${form.aesthetic === a.id ? '#E85D04' : '#3D1F10'}`,
                  borderRadius: 10, color: '#F5F0EB' }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: a.swatch, flexShrink: 0,
                               border: `2px solid ${a.bg}` }} />
                <span>
                  <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#A89080' }}>{a.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <label style={label}>PAGE VISIBILITY</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {[{ v: true, l: '🌍 Public' }, { v: false, l: '🔒 Private' }].map(o => (
              <button type="button" key={String(o.v)} onClick={() => set('page_public', o.v)}
                style={{ flex: 1, padding: '0.85rem', borderRadius: 8, fontWeight: 600,
                  background: form.page_public === o.v ? '#261508' : '#1A100A', color: '#F5F0EB',
                  border: `2px solid ${form.page_public === o.v ? '#E85D04' : '#3D1F10'}` }}>
                {o.l}
              </button>
            ))}
          </div>

          {error && <p style={{ color: '#E85D04', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '1rem', background: '#E85D04', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '1rem',
            opacity: busy ? 0.6 : 1,
          }}>
            {busy ? 'Generating your plan… (~15s)' : 'Launch my plan →'}
          </button>
        </form>
      </div>
    </div>
  )
}
