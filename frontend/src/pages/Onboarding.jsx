import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken } from '../api'

const AESTHETICS = [
  { id: 'dark-ember', label: 'Dark Ember', desc: 'Bold, intense, fire-forged', swatch: '#E85D04', bg: '#0D0805' },
  { id: 'arctic-focus', label: 'Arctic Focus', desc: 'Clean, sharp, clinical', swatch: '#0EA5E9', bg: '#FFFFFF' },
  { id: 'soft-earth', label: 'Soft Earth', desc: 'Warm, grounded, organic', swatch: '#C2714F', bg: '#F5F0E8' },
]

export default function Onboarding() {
  const nav = useNavigate()
  const [goals, setGoals] = useState('')
  const [days, setDays] = useState(7)
  const [aesthetic, setAesthetic] = useState('dark-ember')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!getToken()) nav('/') }, [nav])

  const submit = async e => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.onboard({ goals, duration_days: Number(days), aesthetic })
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

  return (
    <div style={{ minHeight: '100vh', background: '#0D0805', color: '#F5F0EB', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Set your trajectory</h1>
        <p style={{ color: '#A89080', marginBottom: '2.5rem' }}>
          The AI will generate your full plan, theme, and Day 1 signal.
        </p>

        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89080', marginBottom: '0.5rem', fontWeight: 600 }}>
            WHAT ARE YOUR GOALS?
          </label>
          <textarea
            style={{ ...input, minHeight: 110, resize: 'vertical', marginBottom: '1.5rem' }}
            placeholder="Describe what you want to achieve and why it matters…"
            value={goals} onChange={e => setGoals(e.target.value)} required
          />

          <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89080', marginBottom: '0.5rem', fontWeight: 600 }}>
            TIME FRAME (DAYS)
          </label>
          <input
            style={{ ...input, marginBottom: '1.5rem' }}
            type="number" min={1} max={365} value={days}
            onChange={e => setDays(e.target.value)} required
          />

          <label style={{ display: 'block', fontSize: '0.85rem', color: '#A89080', marginBottom: '0.75rem', fontWeight: 600 }}>
            CHOOSE YOUR AESTHETIC
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {AESTHETICS.map(a => (
              <button
                type="button" key={a.id}
                onClick={() => setAesthetic(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem', textAlign: 'left',
                  background: aesthetic === a.id ? '#261508' : '#1A100A',
                  border: `2px solid ${aesthetic === a.id ? '#E85D04' : '#3D1F10'}`,
                  borderRadius: 10, color: '#F5F0EB',
                }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 8, background: a.swatch, flexShrink: 0,
                               border: `2px solid ${a.bg}` }} />
                <span>
                  <span style={{ display: 'block', fontWeight: 700 }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#A89080' }}>{a.desc}</span>
                </span>
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
