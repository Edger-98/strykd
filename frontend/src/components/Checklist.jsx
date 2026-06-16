import { useEffect, useRef, useState } from 'react'
import { motion, Reorder, useDragControls } from 'framer-motion'
import { Check, GripVertical } from 'lucide-react'
import { api } from '../api'
import ProofModal from './ProofModal'
import TaskMenu from './TaskMenu'
import BrainstormDrawer from './BrainstormDrawer'

const VOICE = {
  direct: { label: 'DIRECT', color: '#0071E3' },
  motivational: { label: 'PUSH', color: '#FF2D2D' },
  reflective: { label: 'REFLECT', color: 'var(--d-text-dim)' },
}

/**
 * Task checklist with check/uncheck toggle, inline edit (click the text),
 * trash-on-hover delete, and drag-to-reorder via a subtle handle.
 *
 * Props:
 *  - tasks: array of task objects
 *  - onComplete(taskId, res): fired after checking a task (for streak updates)
 *  - reload(): re-fetch parent data after uncheck / delete / reorder
 */
export default function Checklist({ tasks = [], onComplete, reload, goalName = '' }) {
  const [items, setItems] = useState(tasks)
  const [loading, setLoading] = useState({})
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [proofTask, setProofTask] = useState(null)
  const [brainstormTask, setBrainstormTask] = useState(null)

  // Keep local order in sync when the parent supplies a new task list
  useEffect(() => { setItems(tasks) }, [tasks])

  const setBusy = (id, v) => setLoading(p => ({ ...p, [id]: v }))

  const toggle = async task => {
    if (loading[task.id] || editing === task.id) return
    setBusy(task.id, true)
    try {
      if (!task.completed) {
        const res = await api.completeTask(task.id)
        setItems(arr => arr.map(t => t.id === task.id ? { ...t, completed: true } : t))
        onComplete && onComplete(task.id, res)
      } else {
        await api.updateTask(task.id, { completed: false })
        setItems(arr => arr.map(t => t.id === task.id ? { ...t, completed: false } : t))
        reload && reload()
      }
    } catch (e) { console.error(e) }
    finally { setBusy(task.id, false) }
  }

  const beginEdit = task => { setEditing(task.id); setDraft(task.content) }

  const saveEdit = async task => {
    const content = draft.trim()
    setEditing(null)
    if (!content || content === task.content) return
    setItems(arr => arr.map(t => t.id === task.id ? { ...t, content } : t))
    try { await api.updateTask(task.id, { content }) }
    catch (e) { console.error(e); reload && reload() }
  }

  const remove = async task => {
    setBusy(task.id, true)
    setItems(arr => arr.filter(t => t.id !== task.id))
    try { await api.deleteTask(task.id); reload && reload() }
    catch (e) { console.error(e); reload && reload() }
  }

  const persistOrder = async newOrder => {
    setItems(newOrder)
    try { await api.reorderTasks(newOrder.map(t => t.id)) }
    catch (e) { console.error(e) }
  }

  if (!items.length) {
    return <p style={{ color: 'var(--d-text-muted)', padding: '20px 0' }}>No tasks for today. Check back tomorrow.</p>
  }

  return (
    <>
      <Reorder.Group axis="y" values={items} onReorder={persistOrder} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((task, i) => (
          <Row key={task.id} task={task} last={i === items.length - 1} goalName={goalName}
            busy={!!loading[task.id]} editing={editing === task.id}
            draft={draft} setDraft={setDraft}
            onToggle={() => toggle(task)} onBeginEdit={() => beginEdit(task)}
            onSaveEdit={() => saveEdit(task)} onRemove={() => remove(task)}
            onProof={() => setProofTask(task)} onBrainstorm={() => setBrainstormTask(task)} />
        ))}
      </Reorder.Group>
      <ProofModal open={!!proofTask} task={proofTask}
        onClose={() => setProofTask(null)} onResult={() => reload && reload()} />
      <BrainstormDrawer task={brainstormTask}
        onClose={() => setBrainstormTask(null)} onSavedTask={() => reload && reload()} />
    </>
  )
}

function Row({ task, last, busy, editing, draft, setDraft, onToggle, onBeginEdit, onSaveEdit, onRemove, onProof, onBrainstorm, goalName }) {
  const controls = useDragControls()
  const [hover, setHover] = useState(false)
  const inputRef = useRef(null)
  const v = VOICE[task.voice_style] || VOICE.direct

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  return (
    <Reorder.Item value={task} dragListener={false} dragControls={controls}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 4px',
        borderBottom: last ? 'none' : '1px solid var(--d-line)', opacity: busy ? 0.5 : 1, background: 'var(--d-panel)',
      }}>
      {/* drag handle */}
      <span onPointerDown={e => controls.start(e)}
        style={{ cursor: 'grab', display: 'grid', placeItems: 'center', color: 'var(--d-text-muted)',
          opacity: hover ? 0.7 : 0.25, transition: 'opacity 0.15s', touchAction: 'none' }}
        title="Drag to reorder">
        <GripVertical size={16} />
      </span>

      {/* checkbox */}
      <motion.span className={`dash-check${task.completed ? ' checked' : ''}`} onClick={onToggle}
        style={{ cursor: 'pointer' }}
        animate={task.completed ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 0.3 }}>
        {task.completed && <Check size={14} color="#fff" strokeWidth={3} />}
      </motion.span>

      {/* content / inline edit */}
      {editing ? (
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={onSaveEdit} onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onSaveEdit() }}
          style={{ flex: 1, background: 'var(--d-bg)', color: 'var(--d-text)', border: '1px solid var(--d-line)',
            borderRadius: 8, padding: '8px 10px', fontSize: '0.97rem', outline: 'none' }} />
      ) : (
        <span onClick={onBeginEdit} title="Click to edit"
          style={{ flex: 1, fontSize: '0.97rem', lineHeight: 1.5, cursor: 'text',
            color: task.completed ? 'var(--d-text-muted)' : 'var(--d-text)' }}>
          <span style={{ position: 'relative' }}>
            {task.content}
            <motion.span style={{ position: 'absolute', left: 0, top: '50%', height: 1.5, background: 'currentColor' }}
              initial={false} animate={{ width: task.completed ? '100%' : '0%' }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
          </span>
        </span>
      )}

      {task.duration_minutes ? (
        <span style={{ flexShrink: 0, fontSize: '0.7rem', color: 'var(--d-text-muted)', whiteSpace: 'nowrap' }}>
          ~{task.duration_minutes} min
        </span>
      ) : null}

      <span style={{ flexShrink: 0, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
        color: v.color, border: `1px solid ${v.color}`, borderRadius: 5, padding: '2px 6px', opacity: 0.85 }}>
        {v.label}
      </span>

      {/* unified task actions menu (Ask AI, calendar, proof, delete) */}
      <TaskMenu task={task} title={task.content} date={task.task_date} description={goalName}
        hover={hover} onAskAI={onBrainstorm} onProof={onProof} onDelete={onRemove} />
    </Reorder.Item>
  )
}
