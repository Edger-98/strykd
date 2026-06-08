import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Menu, Plus, Check, Trash2, Repeat, ChevronDown, ChevronRight, StickyNote, Calendar, Loader2, X,
} from 'lucide-react'
import DashSidebar, { SIDEBAR_W } from '../components/DashSidebar'
import ContributionGrid from '../components/ContributionGrid'
import { pageVariants } from '../motion'
import { api, clearToken, getToken } from '../api'

const PRIO = { high: '#FF2D2D', medium: '#FF9F0A', low: '#0071E3' }
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDue = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function Tasks() {
  const nav = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('today') // today | upcoming | all
  const [tagFilter, setTagFilter] = useState(null)
  const [expanded, setExpanded] = useState({})

  const load = useCallback(() => {
    api.getTodos().then(setData).catch(e => {
      if (e.status === 401 || e.status === 403) { clearToken(); nav('/') }
      else setError(e.message)
    })
  }, [nav])

  useEffect(() => { if (!getToken()) { nav('/'); return } load() }, [load, nav])

  if (error) return <Centered>{error}</Centered>
  if (!data) return <Centered>Loading…</Centered>

  const { todos = [], tags = [], grid = [] } = data
  const user = { name: 'You', slug: '' } // sidebar shows avatar via dashboard; minimal here

  const subsByParent = {}
  todos.forEach(t => { if (t.parent_id) (subsByParent[t.parent_id] ||= []).push(t) })
  const parents = todos.filter(t => !t.parent_id)

  const visible = parents.filter(t => {
    if (tagFilter && !(t.tags || []).includes(tagFilter)) return false
    if (filter === 'all') return true
    const due = t.due_date
    if (filter === 'today') return !due || due <= todayISO()
    if (filter === 'upcoming') return due && due > todayISO()
    return true
  })

  const toggle = async t => {
    await api.updateTodo(t.id, { completed: !t.completed }).catch(() => {})
    load()
  }
  const remove = async t => { await api.deleteTodo(t.id).catch(() => {}); load() }

  return (
    <div style={S.shell}>
      <DashSidebar user={data.user || user} active="tasks" navOpen={navOpen} setNavOpen={setNavOpen}
        onLogout={() => { clearToken(); nav('/') }} />
      <motion.main className="dash-main" style={S.main} variants={pageVariants} initial="initial" animate="animate">
        <header style={S.header}>
          <button className="dash-menu-btn" style={S.icon} onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div>
            <p style={S.eyebrow}>YOUR TASKS</p>
            <h1 className="h-lg display" style={{ marginTop: 6 }}>Todo</h1>
          </div>
        </header>

        {grid.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 className="eyebrow" style={S.sectionTitle}>Contribution</h2>
            <ContributionGrid days={grid} dark square={12} />
          </section>
        )}

        <AddBar onAdded={load} />

        {/* filters */}
        <div style={S.filters}>
          {['today', 'upcoming', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ ...S.filterChip, ...(filter === f ? S.filterActive : {}) }}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
          {tags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              style={{ ...S.tagChip, ...(tagFilter === tag ? S.tagActive : {}) }}>#{tag}</button>
          ))}
        </div>

        {/* list */}
        <div style={{ marginTop: 8 }}>
          {visible.length === 0
            ? <p style={{ color: 'var(--d-text-muted)', padding: '24px 0' }}>Nothing here. Add a task above.</p>
            : visible.map(t => (
              <TodoRow key={t.id} t={t} subs={subsByParent[t.id] || []}
                expanded={!!expanded[t.id]} onExpand={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}
                onToggle={toggle} onRemove={remove} onChanged={load} />
            ))}
        </div>

        <SharedLists />
      </motion.main>
    </div>
  )
}

function SharedLists() {
  const [lists, setLists] = useState(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [genBusy, setGenBusy] = useState('')

  const load = useCallback(() => { api.getSharedLists().then(d => setLists(d.lists)).catch(() => setLists([])) }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    const n = name.trim(); if (!n || busy) return
    setBusy(true)
    try { await api.createSharedList({ name: n, description: desc.trim() || undefined }); setName(''); setDesc(''); setOpen(false); load() }
    catch (e) { /* ignore */ } finally { setBusy(false) }
  }
  const copy = (url, code) => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(code); setTimeout(() => setCopied(''), 1800) }
  const generate = async code => {
    setGenBusy(code)
    try { await api.generateItinerary(code); load() } catch (e) { /* ignore */ } finally { setGenBusy('') }
  }
  const remove = async code => {
    if (!window.confirm('Delete this shared list? Everyone with the link loses access.')) return
    await api.deleteSharedList(code).catch(() => {}); load()
  }

  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--d-line)', paddingBottom: 12, marginBottom: 14 }}>
        <h2 className="eyebrow" style={{ color: 'var(--d-text-muted)' }}>Shared lists</h2>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
          {open ? 'Close' : '+ New shared list'}
        </button>
      </div>
      <p style={{ color: 'var(--d-text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
        Collaborative checklists anyone can open and edit with a link. Great for trips, events, group projects.
      </p>

      {open && (
        <div style={{ ...S.addWrap, marginBottom: 16 }}>
          <input className="d-field" placeholder="List name (e.g. Maya's Birthday Weekend)" value={name} onChange={e => setName(e.target.value)} />
          <input className="d-field" placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} style={{ marginTop: 8 }} />
          <button className="pill pill-blue pill-sm" onClick={create} disabled={busy} style={{ marginTop: 10 }}>
            {busy ? <Loader2 size={15} className="spin-icon" /> : 'Create shared list'}
          </button>
        </div>
      )}

      {(lists || []).map(l => (
        <div key={l.unique_code} style={S.sharedCard}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{l.name}</div>
            <div style={{ color: 'var(--d-text-muted)', fontSize: '0.8rem', marginTop: 2 }}>{l.done_count}/{l.task_count} done · /shared/{l.unique_code}</div>
          </div>
          <button onClick={() => copy(l.share_url, l.unique_code)} style={S.smallBtn}>{copied === l.unique_code ? 'Copied' : 'Copy link'}</button>
          <button onClick={() => generate(l.unique_code)} disabled={!!genBusy} style={S.smallBtn}>
            {genBusy === l.unique_code ? <Loader2 size={13} className="spin-icon" /> : (l.itinerary ? 'Redo itinerary' : 'Itinerary')}
          </button>
          <button onClick={() => remove(l.unique_code)} style={{ ...S.smallBtn, color: 'var(--red)' }}>Delete</button>
        </div>
      ))}
      {lists && lists.length === 0 && !open && (
        <p style={{ color: 'var(--d-text-muted)', fontSize: '0.88rem' }}>No shared lists yet.</p>
      )}
    </section>
  )
}

function TodoRow({ t, subs, expanded, onExpand, onToggle, onRemove, onChanged }) {
  const [hover, setHover] = useState(false)
  const [subInput, setSubInput] = useState('')
  const overdue = t.due_date && t.due_date < todayISO() && !t.completed
  const hasDetail = subs.length > 0 || t.notes

  const addSub = async () => {
    const c = subInput.trim(); if (!c) return
    setSubInput('')
    await api.createTodo({ content: c, parent_id: t.id }).catch(() => {})
    onChanged()
  }

  return (
    <div style={{ borderBottom: '1px solid var(--d-line)' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={S.row}>
        <button onClick={() => onToggle(t)} className={`dash-check${t.completed ? ' checked' : ''}`} style={{ cursor: 'pointer' }}>
          {t.completed && <Check size={13} color="#fff" strokeWidth={3} />}
        </button>
        {t.priority && <span title={t.priority} style={{ ...S.dot, background: PRIO[t.priority] }} />}
        <span style={{ flex: 1, color: t.completed ? 'var(--d-text-muted)' : 'var(--d-text)',
          textDecoration: t.completed ? 'line-through' : 'none', fontSize: '0.96rem' }}>{t.content}</span>

        {t.recurring && <Repeat size={13} color="var(--d-text-muted)" title={t.recurring} />}
        {t.due_date && <span style={{ ...S.due, color: overdue ? 'var(--red)' : 'var(--d-text-dim)' }}>
          <Calendar size={11} /> {fmtDue(t.due_date)}</span>}
        {(t.tags || []).map(tag => <span key={tag} style={S.tag}>#{tag}</span>)}

        {hasDetail && (
          <button onClick={onExpand} style={S.iconBtn} aria-label="Expand">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <button onClick={() => onRemove(t)} aria-label="Delete"
          style={{ ...S.iconBtn, opacity: hover ? 0.8 : 0 }}><Trash2 size={14} /></button>
      </div>

      {expanded && (
        <div style={{ padding: '0 4px 14px 40px' }}>
          {t.notes && <p style={S.notes}><StickyNote size={12} style={{ verticalAlign: -1, marginRight: 5 }} />{t.notes}</p>}
          {subs.map(s => (
            <div key={s.id} style={S.subRow}>
              <button onClick={() => onToggle(s)} className={`dash-check sm${s.completed ? ' checked' : ''}`}
                style={{ cursor: 'pointer', transform: 'scale(0.85)' }}>{s.completed && <Check size={11} color="#fff" strokeWidth={3} />}</button>
              <span style={{ flex: 1, fontSize: '0.9rem', color: s.completed ? 'var(--d-text-muted)' : 'var(--d-text-dim)',
                textDecoration: s.completed ? 'line-through' : 'none' }}>{s.content}</span>
              <button onClick={() => onRemove(s)} style={S.iconBtn}><X size={13} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input value={subInput} onChange={e => setSubInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSub()}
              placeholder="Add a subtask" className="d-field" style={{ fontSize: '0.85rem', padding: '7px 10px' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function AddBar({ onAdded }) {
  const [content, setContent] = useState('')
  const [open, setOpen] = useState(false)
  const [priority, setPriority] = useState('')
  const [due, setDue] = useState('')
  const [recurring, setRecurring] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const c = content.trim(); if (!c || busy) return
    setBusy(true)
    try {
      await api.createTodo({
        content: c, priority: priority || null, due_date: due || null,
        recurring: recurring || null,
        tags: tagsStr.split(',').map(s => s.trim()).filter(Boolean),
      })
      setContent(''); setPriority(''); setDue(''); setRecurring(''); setTagsStr(''); setOpen(false)
      onAdded()
    } catch (e) { /* ignore */ } finally { setBusy(false) }
  }

  return (
    <div style={S.addWrap}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={content} onChange={e => setContent(e.target.value)} onFocus={() => setOpen(true)}
          onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Add a task..." className="d-field" />
        <button className="pill pill-blue pill-sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin-icon" /> : <><Plus size={15} /> Add</>}
        </button>
      </div>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={S.addOpts}>
          <div style={S.optGroup}>
            <span style={S.optLabel}>Priority</span>
            {['high', 'medium', 'low'].map(p => (
              <button key={p} onClick={() => setPriority(priority === p ? '' : p)}
                style={{ ...S.prioBtn, borderColor: priority === p ? PRIO[p] : 'var(--d-line)' }}>
                <span style={{ ...S.dot, background: PRIO[p] }} /> {p}
              </button>
            ))}
          </div>
          <div style={S.optGroup}>
            <span style={S.optLabel}>Due</span>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} className="d-field" style={S.optField} />
          </div>
          <div style={S.optGroup}>
            <span style={S.optLabel}>Repeat</span>
            {['daily', 'weekly'].map(r => (
              <button key={r} onClick={() => setRecurring(recurring === r ? '' : r)}
                style={{ ...S.prioBtn, borderColor: recurring === r ? 'var(--blue)' : 'var(--d-line)' }}>{r}</button>
            ))}
          </div>
          <div style={S.optGroup}>
            <span style={S.optLabel}>Tags</span>
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="work, launch"
              className="d-field" style={S.optField} />
          </div>
        </motion.div>
      )}
    </div>
  )
}

function Centered({ children }) {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--d-panel)', color: 'var(--d-text-dim)' }}><p>{children}</p></div>
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--d-panel)', display: 'flex', color: 'var(--d-text)' },
  main: { flex: 1, marginLeft: SIDEBAR_W, padding: '40px clamp(20px, 5vw, 56px)', maxWidth: 760, width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  eyebrow: { color: 'var(--d-text-muted)', fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
  sectionTitle: { color: 'var(--d-text-muted)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--d-line)' },
  addWrap: { background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 16, padding: 14, marginBottom: 20 },
  addOpts: { display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 14, overflow: 'hidden' },
  optGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  optLabel: { fontSize: '0.72rem', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--d-text-muted)', textTransform: 'uppercase' },
  optField: { width: 'auto', fontSize: '0.85rem', padding: '7px 10px' },
  prioBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 50, background: 'var(--d-bg)',
    border: '1px solid var(--d-line)', color: 'var(--d-text-dim)', fontSize: '0.8rem', textTransform: 'capitalize', cursor: 'pointer' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  filterChip: { padding: '7px 16px', borderRadius: 50, background: 'var(--d-card)', border: '1px solid var(--d-line)',
    color: 'var(--d-text-dim)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' },
  filterActive: { background: 'rgba(0,113,227,0.14)', borderColor: 'var(--blue)', color: 'var(--blue)' },
  tagChip: { padding: '7px 12px', borderRadius: 50, background: 'var(--d-card)', border: '1px solid var(--d-line)',
    color: 'var(--d-text-muted)', fontSize: '0.8rem', cursor: 'pointer' },
  tagActive: { background: 'rgba(255,45,45,0.12)', borderColor: 'var(--red)', color: 'var(--red)' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px' },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  due: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', flexShrink: 0 },
  tag: { fontSize: '0.72rem', color: 'var(--d-text-muted)', background: 'var(--d-bg)', border: '1px solid var(--d-line)', borderRadius: 6, padding: '2px 7px' },
  iconBtn: { background: 'transparent', border: 'none', color: 'var(--d-text-muted)', padding: 4, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' },
  notes: { color: 'var(--d-text-dim)', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 10, background: 'var(--d-card)', padding: '10px 12px', borderRadius: 10 },
  subRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' },
  sharedCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--d-card)',
    border: '1px solid var(--d-line)', borderRadius: 12, marginBottom: 10, flexWrap: 'wrap' },
  smallBtn: { background: 'var(--d-bg)', border: '1px solid var(--d-line)', color: 'var(--d-text-dim)', borderRadius: 50,
    padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 },
}
