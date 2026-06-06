import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingWizard from '../components/OnboardingWizard'
import { api, getToken } from '../api'

export default function Onboarding() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (!getToken()) nav('/') }, [nav])

  const submit = async form => {
    setBusy(true); setError('')
    try {
      // Save the plan and start the 7-day free trial, no payment, straight to dashboard
      await api.onboard({ ...form, duration_days: Number(form.duration_days), hours_per_day: Number(form.hours_per_day) })
      nav('/dashboard?welcome=1')
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--white)', color: 'var(--ink)' }}>
      <OnboardingWizard onSubmit={submit} busy={busy} error={error} mode="signup" />
    </div>
  )
}
