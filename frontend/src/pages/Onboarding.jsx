import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingWizard from '../components/OnboardingWizard'
import OnboardingStream from '../components/OnboardingStream'
import { getToken } from '../api'

export default function Onboarding() {
  const nav = useNavigate()
  const [phase, setPhase] = useState('wizard') // 'wizard' | 'streaming'
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { if (!getToken()) nav('/') }, [nav])

  const submit = f => {
    setForm({ ...f, duration_days: Number(f.duration_days), hours_per_day: Number(f.hours_per_day) })
    setError('')
    setPhase('streaming')
  }

  if (phase === 'streaming' && form) {
    // Cinematic streaming build, then straight to the dashboard with the 30-day trial live
    return (
      <OnboardingStream
        form={form}
        onDone={() => nav('/dashboard?welcome=1')}
        onCancel={() => { setError('Something interrupted the build. Your answers are below.'); setPhase('wizard') }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)', color: 'var(--ink)' }}>
      <OnboardingWizard onSubmit={submit} busy={false} error={error} mode="signup" initialForm={form || undefined} />
    </div>
  )
}
