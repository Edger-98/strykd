import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Menu, Loader2, Camera, Check, AlertTriangle, CreditCard, ExternalLink, Trash2,
} from 'lucide-react'
import DashSidebar, { SIDEBAR_W } from '../components/DashSidebar'
import Avatar from '../components/Avatar'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'

const MAX_BYTES = 5 * 1024 * 1024

export default function Settings() {
  const nav = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.getMe().then(setMe).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else setError(e.message)
    })
  }, [nav])

  useEffect(() => {
    if (!getToken()) { nav('/'); return }
    load()
  }, [load, nav])

  if (error) return <Centered>{error}</Centered>
  if (!me) return <Centered>Loading…</Centered>

  const user = { ...me.user, avatar_url: me.user.avatar_url }

  return (
    <div style={S.shell}>
      <DashSidebar user={user} active="settings" navOpen={navOpen} setNavOpen={setNavOpen}
        onLogout={() => { clearToken(); nav('/') }} />

      <motion.main className="dash-main" style={S.main} variants={pageVariants} initial="initial" animate="animate">
        <header style={S.header}>
          <button className="dash-menu-btn" style={S.icon} onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div>
            <p style={S.eyebrow}>ACCOUNT</p>
            <h1 className="h-lg display" style={{ marginTop: 6 }}>Settings</h1>
          </div>
        </header>

        <ProfileSection me={me} onSaved={load} />
        <SecuritySection />
        <SubscriptionSection sub={me.subscription} trial={me.trial} />
        <NotificationsSection initial={me.user.email_reminders} />
        <DangerSection onDeleted={() => { clearToken(); nav('/') }} />
      </motion.main>
    </div>
  )
}

function Section({ title, desc, children }) {
  return (
    <section style={S.section}>
      <h2 className="eyebrow" style={S.sectionTitle}>{title}</h2>
      {desc && <p style={S.sectionDesc}>{desc}</p>}
      {children}
    </section>
  )
}

function Saved({ show }) {
  return show ? <span style={S.saved}><Check size={14} /> Saved</span> : null
}

function ProfileSection({ me, onSaved }) {
  const u = me.user
  const fileRef = useRef(null)
  const [name, setName] = useState(u.name || '')
  const [slug, setSlug] = useState(u.slug || '')
  const [bio, setBio] = useState(u.bio || '')
  const [avatar, setAvatar] = useState(u.avatar_url || null)
  const [pagePublic, setPagePublic] = useState(u.page_public)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  const pickFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setErr('Please upload a JPG or PNG image.'); return }
    if (file.size > MAX_BYTES) { setErr('Image must be 5MB or smaller.'); return }
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setBusy(true); setErr(''); setSaved(false)
    try {
      await api.updateMe({ name, slug, bio, avatar_url: avatar || '', page_public: pagePublic })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      onSaved()
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Section title="Profile" desc="Your name, handle, and how you show up on your public page.">
      <div style={S.card}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={avatar} name={name} size={72} />
            <button onClick={() => fileRef.current?.click()} style={S.camBtn} aria-label="Change photo"><Camera size={15} /></button>
          </div>
          <div>
            <button className="pill pill-dark pill-sm" onClick={() => fileRef.current?.click()}>Upload photo</button>
            {avatar && <button onClick={() => setAvatar(null)} style={S.removeLink}>Remove</button>}
            <p style={{ color: 'var(--d-text-muted)', fontSize: '0.78rem', marginTop: 8 }}>JPG or PNG, up to 5MB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={pickFile} style={{ display: 'none' }} />
        </div>

        <Field label="Name">
          <input className="d-field" value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Email"><input className="d-field" value={u.email} disabled style={{ opacity: 0.6 }} /></Field>
        <Field label="Page handle (slug)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--d-text-muted)', fontSize: '0.9rem' }}>strykd.app/</span>
            <input className="d-field" value={slug} onChange={e => setSlug(e.target.value.toLowerCase())}
              pattern="[a-z0-9-]+" style={{ flex: 1 }} />
          </div>
        </Field>
        <Field label={`Bio (${bio.length}/160) — shown on your public page`}>
          <textarea className="d-field" value={bio} maxLength={160} rows={3}
            onChange={e => setBio(e.target.value)} style={{ resize: 'vertical' }} />
        </Field>

        <label style={S.toggleRow}>
          <span>
            <span style={{ fontWeight: 600 }}>Public page</span>
            <span style={S.toggleHint}>Make your progress page visible to anyone with the link.</span>
          </span>
          <Toggle on={pagePublic} onChange={setPagePublic} />
        </label>

        {err && <p style={S.err}>{err}</p>}
        <div style={S.actionRow}>
          <button className="pill pill-blue pill-sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin-icon" /> : 'Save changes'}
          </button>
          <Saved show={saved} />
        </div>
      </div>
    </Section>
  )
}

function SecuritySection() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.changePassword({ current_password: cur, new_password: next })
      setMsg('Password updated.'); setCur(''); setNext('')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Section title="Security" desc="Change your password.">
      <div style={S.card}>
        <Field label="Current password"><input className="d-field" type="password" value={cur} onChange={e => setCur(e.target.value)} /></Field>
        <Field label="New password"><input className="d-field" type="password" value={next} onChange={e => setNext(e.target.value)} /></Field>
        {err && <p style={S.err}>{err}</p>}
        {msg && <p style={{ ...S.saved, marginBottom: 12 }}><Check size={14} /> {msg}</p>}
        <button className="pill pill-blue pill-sm" onClick={save} disabled={busy || !cur || !next}>
          {busy ? <Loader2 size={15} className="spin-icon" /> : 'Update password'}
        </button>
      </div>
    </Section>
  )
}

function SubscriptionSection({ sub, trial }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [cancelled, setCancelled] = useState(false)

  const portal = async () => {
    setBusy('portal'); setErr('')
    try { const { portal_url } = await api.billingPortal(); if (portal_url) window.location.href = portal_url }
    catch (e) { setErr(e.message); setBusy('') }
  }
  const checkout = async () => {
    setBusy('checkout'); setErr('')
    try { const { checkout_url } = await api.checkout(); if (checkout_url) window.location.href = checkout_url }
    catch (e) { setErr(e.message); setBusy('') }
  }
  const cancel = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until the end of the current billing period.')) return
    setBusy('cancel'); setErr('')
    try { await api.cancelSubscription(); setCancelled(true) }
    catch (e) { setErr(e.message) }
    finally { setBusy('') }
  }

  const active = sub?.active
  const status = cancelled ? 'cancelled' : (sub?.status || (active ? 'active' : null))
  const nextBilling = sub?.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <Section title="Subscription" desc="Manage your plan and billing.">
      <div style={S.card}>
        <div style={S.subRow}>
          <span style={{ color: 'var(--d-text-dim)' }}>Plan</span>
          <span style={{ fontWeight: 600 }}>{active ? 'Strykd · $9/month' : 'Free trial'}</span>
        </div>
        {status && (
          <div style={S.subRow}>
            <span style={{ color: 'var(--d-text-dim)' }}>Status</span>
            <span style={{ fontWeight: 600, textTransform: 'capitalize',
              color: status === 'active' ? '#34C759' : status === 'cancelled' ? 'var(--red)' : 'var(--d-text)' }}>{status}</span>
          </div>
        )}
        {!active && trial?.days_left != null && (
          <div style={S.subRow}>
            <span style={{ color: 'var(--d-text-dim)' }}>Trial remaining</span>
            <span style={{ fontWeight: 600 }}>{trial.days_left} day{trial.days_left === 1 ? '' : 's'}</span>
          </div>
        )}
        {active && nextBilling && !cancelled && (
          <div style={S.subRow}>
            <span style={{ color: 'var(--d-text-dim)' }}>Next billing date</span>
            <span style={{ fontWeight: 600 }}>{nextBilling}</span>
          </div>
        )}
        {cancelled && <p style={{ color: 'var(--d-text-dim)', fontSize: '0.9rem', marginTop: 12 }}>Your subscription will end at the close of the current period.</p>}

        {err && <p style={S.err}>{err}</p>}
        <div style={{ ...S.actionRow, marginTop: 20 }}>
          {active ? (
            <>
              <button className="pill pill-dark pill-sm" onClick={portal} disabled={!!busy}>
                {busy === 'portal' ? <Loader2 size={15} className="spin-icon" /> : <><CreditCard size={15} /> Manage billing</>}
              </button>
              {!cancelled && (
                <button onClick={cancel} disabled={!!busy} style={S.dangerLink}>
                  {busy === 'cancel' ? <Loader2 size={15} className="spin-icon" /> : 'Cancel subscription'}
                </button>
              )}
            </>
          ) : (
            <button className="pill pill-blue pill-sm" onClick={checkout} disabled={!!busy}>
              {busy === 'checkout' ? <Loader2 size={15} className="spin-icon" /> : <><CreditCard size={15} /> Subscribe for $9/month</>}
            </button>
          )}
        </div>
      </div>
    </Section>
  )
}

function NotificationsSection({ initial }) {
  const [on, setOn] = useState(initial)
  const [saving, setSaving] = useState(false)

  const change = async v => {
    setOn(v); setSaving(true)
    try { await api.updateMe({ email_reminders: v }) }
    catch (e) { setOn(!v) }
    finally { setSaving(false) }
  }

  return (
    <Section title="Notifications" desc="Control the emails Strykd sends you.">
      <div style={S.card}>
        <label style={{ ...S.toggleRow, marginBottom: 0 }}>
          <span>
            <span style={{ fontWeight: 600 }}>Email reminders {saving && <Loader2 size={13} className="spin-icon" style={{ verticalAlign: -1 }} />}</span>
            <span style={S.toggleHint}>Get a nudge if your streak is at risk and a few other key emails.</span>
          </span>
          <Toggle on={on} onChange={change} />
        </label>
      </div>
    </Section>
  )
}

function DangerSection({ onDeleted }) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const del = async () => {
    setBusy(true); setErr('')
    try { await api.deleteAccount(); onDeleted() }
    catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <Section title="Danger zone">
      <div style={{ ...S.card, border: '1px solid rgba(255,45,45,0.4)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Delete account</p>
            <p style={{ color: 'var(--d-text-dim)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              This permanently deletes your goals, tasks, streaks, and public page. This cannot be undone.
            </p>
          </div>
        </div>
        <p style={{ color: 'var(--d-text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>Type DELETE to confirm.</p>
        <input className="d-field" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" style={{ marginBottom: 14 }} />
        {err && <p style={S.err}>{err}</p>}
        <button onClick={del} disabled={confirm !== 'DELETE' || busy}
          className="pill pill-sm" style={{ background: 'var(--red)', color: '#fff', opacity: confirm === 'DELETE' ? 1 : 0.5 }}>
          {busy ? <Loader2 size={15} className="spin-icon" /> : <><Trash2 size={15} /> Delete my account</>}
        </button>
      </div>
    </Section>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 46, height: 26, borderRadius: 50, border: 'none', flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--blue)' : 'var(--d-line)', position: 'relative', transition: 'background 0.2s' }}>
      <motion.span animate={{ x: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        style={{ position: 'absolute', top: 2, left: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
    </button>
  )
}

function Centered({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--d-panel)', color: 'var(--d-text-dim)' }}><p>{children}</p></div>
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--d-panel)', display: 'flex', color: 'var(--d-text)' },
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '40px clamp(20px, 5vw, 56px)', maxWidth: 720, width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 },
  eyebrow: { color: 'var(--d-text-muted)', fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
  section: { marginBottom: 40 },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 6 },
  sectionDesc: { color: 'var(--d-text-dim)', fontSize: '0.9rem', marginBottom: 16 },
  card: { background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 24 },
  label: { display: 'block', fontSize: '0.8rem', color: 'var(--d-text-dim)', fontWeight: 600, marginBottom: 6 },
  actionRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  saved: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34C759', fontSize: '0.85rem', fontWeight: 600 },
  err: { color: 'var(--red)', fontSize: '0.85rem', margin: '4px 0 12px' },
  camBtn: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--blue)',
    border: '2px solid var(--d-card)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  removeLink: { background: 'none', border: 'none', color: 'var(--d-text-muted)', fontSize: '0.82rem', marginLeft: 12, cursor: 'pointer' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 0', marginBottom: 8, cursor: 'pointer' },
  toggleHint: { display: 'block', color: 'var(--d-text-muted)', fontSize: '0.82rem', marginTop: 3, maxWidth: 420, lineHeight: 1.45 },
  subRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--d-line)', fontSize: '0.92rem' },
  dangerLink: { background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
}
