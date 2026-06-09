import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Plus, Loader2, Sparkles, MapPin, Package, Lightbulb, ArrowRight, Trash2, User } from 'lucide-react'
import { api } from '../api'

const NAME_KEY = 'strykd_guest_name'
const SESSION_KEY = 'strykd_guest_session'

function getSession() {
  let s = localStorage.getItem(SESSION_KEY)
  if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem(SESSION_KEY, s) }
  return s
}

export default function SharedListPage() {
  const { code } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [assignee, setAssignee] = useState('')
  const [guest, setGuest] = useState(() => localStorage.getItem(NAME_KEY) || '')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const session = getSession()

  const load = useCallback(() => {
    api.getSharedList(code).then(setData).catch(() => setError('This list does not exist.'))
  }, [code])

  useEffect(() => { load() }, [load])

  if (error) return <Splash>{error}</Splash>
  if (!data) return <Splash>Loading…</Splash>

  const isOwner = !!data.is_owner
  const saveGuest = v => { setGuest(v); localStorage.setItem(NAME_KEY, v) }
  const canDelete = t => isOwner || (t.added_by_session && t.added_by_session === session)

  const add = async () => {
    const c = input.trim()
    if (!c || busy) return
    setBusy(true)
    try {
      const t = await api.addSharedTask(code, { content: c, assigned_to: assignee.trim() || undefined, session })
      setData(d => ({ ...d, tasks: [...d.tasks, t] }))
      setInput(''); setAssignee('')
    } catch (e) { /* ignore */ } finally { setBusy(false) }
  }

  const toggle = async t => {
    const next = !t.completed
    setData(d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, completed: next, completed_by: next ? (guest || 'A guest') : null } : x) }))
    try { await api.editSharedTask(code, t.id, { completed: next, guest_name: guest || undefined }) }
    catch (e) { load() }
  }

  const saveEdit = async t => {
    const c = draft.trim(); setEditing(null)
    if (!c || c === t.content) return
    setData(d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, content: c } : x) }))
    try { await api.editSharedTask(code, t.id, { content: c }) } catch (e) { load() }
  }

  const remove = async t => {
    setData(d => ({ ...d, tasks: d.tasks.filter(x => x.id !== t.id) }))
    try { await api.deleteSharedTask(code, t.id, session) } catch (e) { load() }
  }

  const done = data.tasks.filter(t => t.completed).length
  const it = data.itinerary

  return (
    <div style={S.shell}>
      <div style={S.container}>
        <p style={S.eyebrow}>SHARED LIST</p>
        <h1 className="display" style={S.title}>{data.name}</h1>
        {data.description && <p style={S.desc}>{data.description}</p>}
        <p style={S.count}>{done} of {data.tasks.length} done</p>

        <div style={{ marginTop: 24 }}>
          {data.tasks.map(t => (
            <Row key={t.id} t={t} editing={editing === t.id} draft={draft} setDraft={setDraft}
              canDelete={canDelete(t)} onToggle={() => toggle(t)}
              onBeginEdit={() => { setEditing(t.id); setDraft(t.content) }} onSaveEdit={() => saveEdit(t)}
              onRemove={() => remove(t)} />
          ))}
          {data.tasks.length === 0 && <p style={{ color: 'var(--gray-light)', padding: '16px 0' }}>No tasks yet. Add the first one below.</p>}
        </div>

        {/* add task (guests welcome, no account) */}
        <div style={S.addBox}>
          <input className="field" value={input} placeholder="Add a task" onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="pill pill-dark" onClick={add} disabled={busy} style={{ flexShrink: 0 }}>
            {busy ? <Loader2 size={16} className="spin-icon" /> : <><Plus size={16} /> Add</>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <input className="field" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Assign to (optional)"
            style={{ fontSize: '0.9rem', padding: '0.7rem 1rem' }} />
          <input className="field" value={guest} onChange={e => saveGuest(e.target.value)} placeholder="Your name (optional)"
            style={{ fontSize: '0.9rem', padding: '0.7rem 1rem' }} />
        </div>

        {/* itinerary */}
        {it && (
          <div style={{ marginTop: 40 }}>
            <h2 className="eyebrow" style={S.sectionTitle}><Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Itinerary</h2>
            {it.time_blocks?.length > 0 && it.time_blocks.map((b, i) => (
              <div key={i} style={S.block}>
                <div style={S.blockTime}><MapPin size={13} /> {b.time}</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{b.title}</div>
                <p style={{ color: 'var(--gray-text)', fontSize: '0.92rem', marginTop: 4 }}>{b.detail}</p>
              </div>
            ))}
            {it.suggestions?.length > 0 && (
              <div style={S.subBlock}><p style={S.subHead}><Lightbulb size={13} /> Suggestions</p>
                <ul style={S.ul}>{it.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {it.packing_list?.length > 0 && (
              <div style={S.subBlock}><p style={S.subHead}><Package size={13} /> Packing list</p>
                <ul style={S.ul}>{it.packing_list.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
          </div>
        )}

        {/* Powered by Strykd + signup CTA */}
        <div style={S.foot}>
          <p style={{ color: 'var(--gray-light)', fontSize: '0.85rem', marginBottom: 14 }}>Plan anything, together. Powered by <strong>Strykd</strong>.</p>
          <button className="pill pill-dark pill-sm" onClick={() => nav('/')}>Create your own <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  )
}

function Row({ t, editing, draft, setDraft, canDelete, onToggle, onBeginEdit, onSaveEdit, onRemove }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={S.row}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={onToggle} style={{ ...S.check, background: t.completed ? 'var(--red)' : 'transparent', borderColor: t.completed ? 'var(--red)' : 'var(--gray-line)' }}>
        {t.completed && <Check size={14} color="#fff" strokeWidth={3} />}
      </button>
      {editing ? (
        <input autoFocus className="field" value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={onSaveEdit} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') onSaveEdit() }}
          style={{ flex: 1, fontSize: '0.95rem', padding: '0.5rem 0.7rem' }} />
      ) : (
        <span onClick={onBeginEdit} title="Click to edit" style={{ flex: 1, cursor: 'text',
          color: t.completed ? 'var(--gray-light)' : 'var(--ink)', textDecoration: t.completed ? 'line-through' : 'none' }}>
          {t.content}
        </span>
      )}
      {t.assigned_to && <span style={S.assignee}><User size={11} /> {t.assigned_to}</span>}
      {t.completed && t.completed_by && <span style={S.by}>{t.completed_by}</span>}
      {canDelete && (
        <button onClick={onRemove} aria-label="Delete task"
          style={{ ...S.del, opacity: hover ? 0.8 : 0 }}><Trash2 size={15} /></button>
      )}
    </motion.div>
  )
}

function Splash({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--gray-section)' }}><p style={{ color: 'var(--gray-text)' }}>{children}</p></div>
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--gray-section)', padding: '48px 20px' },
  container: { maxWidth: 560, margin: '0 auto', background: 'var(--white)', borderRadius: 24, padding: 'clamp(24px, 5vw, 44px)', boxShadow: 'var(--shadow-card)' },
  eyebrow: { fontSize: '0.72rem', letterSpacing: '0.16em', fontWeight: 700, color: 'var(--gray-light)' },
  title: { fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', lineHeight: 1.1, margin: '10px 0 0' },
  desc: { color: 'var(--gray-text)', fontSize: '1rem', lineHeight: 1.5, marginTop: 12 },
  count: { color: 'var(--gray-light)', fontSize: '0.85rem', fontWeight: 600, marginTop: 14 },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--gray-line)' },
  check: { width: 24, height: 24, borderRadius: 7, border: '2px solid var(--gray-line)', flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  by: { fontSize: '0.72rem', color: 'var(--gray-light)', background: 'var(--gray-section)', borderRadius: 50, padding: '3px 9px', flexShrink: 0 },
  assignee: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--red)', background: 'rgba(255,45,45,0.08)', borderRadius: 50, padding: '3px 9px', flexShrink: 0, fontWeight: 600 },
  del: { background: 'none', border: 'none', color: 'var(--gray-light)', padding: 4, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },
  addBox: { display: 'flex', gap: 10, marginTop: 24, alignItems: 'stretch' },
  sectionTitle: { color: 'var(--gray-text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--gray-line)' },
  block: { padding: '14px 16px', background: 'var(--gray-section)', borderRadius: 12, marginBottom: 10 },
  blockTime: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--red)', textTransform: 'uppercase' },
  subBlock: { marginTop: 16 },
  subHead: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink)', textTransform: 'uppercase' },
  ul: { margin: '8px 0 0', paddingLeft: 20, color: 'var(--gray-text)', fontSize: '0.92rem', lineHeight: 1.7 },
  foot: { marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--gray-line)', textAlign: 'center' },
}
