import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Send, Plus, Check, RotateCcw, Loader2 } from 'lucide-react'
import { api } from '../api'

const opening = task => ({
  role: 'assistant',
  content:
    `I can see you're working on: ${task?.content || 'this task'}. What would you like help with? ` +
    'I can break this down, give examples, help you brainstorm, or talk through any blockers.',
})

/**
 * Right-side AI chat drawer scoped to a single task. Streams responses via SSE.
 * Conversation lives in local state only (nothing persisted server-side).
 *
 * Props:
 *  - task: the task object, or null/undefined when closed (drives open state)
 *  - onClose(): close the drawer
 *  - onSavedTask(): called after an AI suggestion is saved as a quick task
 */
export default function BrainstormDrawer({ task, onClose, onSavedTask }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState({}) // message index -> true
  const scrollRef = useRef(null)
  const abortRef = useRef(null)

  // Reset the chat each time the drawer opens for a (different) task.
  useEffect(() => {
    if (task) {
      setMessages([opening(task)])
      setInput(''); setError(''); setSaved({}); setStreaming(false)
    }
    return () => abortRef.current?.abort()
  }, [task?.id])

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming || !task) return
    const history = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput(''); setStreaming(true); setError('')

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await api.brainstormStream(task.id, history, controller.signal)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Request failed') }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            if (raw === '[DONE]') { setStreaming(false); return }
            let tok
            try { tok = JSON.parse(raw) } catch { tok = raw }
            if (typeof tok === 'string' && tok.startsWith('[ERROR]')) { setError(tok.slice(7).trim()); continue }
            setMessages(m => {
              const c = [...m]
              c[c.length - 1] = { ...c[c.length - 1], content: c[c.length - 1].content + tok }
              return c
            })
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setStreaming(false)
    }
  }

  const saveAsTask = async (content, idx) => {
    try {
      await api.addQuickTask(content.trim())
      setSaved(s => ({ ...s, [idx]: true }))
      onSavedTask && onSavedTask()
    } catch (e) { setError(e.message) }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setStreaming(false); setError(''); setSaved({})
    setMessages(task ? [opening(task)] : [])
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div onClick={onClose} style={S.backdrop}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={S.drawer}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            {/* header */}
            <div style={S.head}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <Sparkles size={18} color="var(--red)" /> AI Assistant
                </span>
                <p style={S.context} title={task.content}>{task.content}</p>
              </div>
              <button onClick={onClose} style={S.x} aria-label="Close"><X size={18} /></button>
            </div>

            {/* messages */}
            <div ref={scrollRef} style={S.messages}>
              {messages.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} style={S.userRow}>
                    <div style={S.userBubble}>{m.content}</div>
                  </div>
                ) : (
                  <div key={i} style={S.aiRow}>
                    <div style={S.aiCard}>
                      {m.content
                        ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                        : <span style={{ color: 'var(--d-text-muted)' }}>Thinking…</span>}
                      {streaming && i === messages.length - 1 && m.content &&
                        <span style={{ animation: 'blink 1s step-end infinite' }}>▋</span>}
                    </div>
                    {/* Save-as-task on completed AI answers (not the opening greeting) */}
                    {i > 0 && m.content && !(streaming && i === messages.length - 1) && (
                      <button onClick={() => saveAsTask(m.content, i)} disabled={saved[i]} style={S.saveBtn}>
                        {saved[i] ? <><Check size={13} /> Saved as task</> : <><Plus size={13} /> Save as task</>}
                      </button>
                    )}
                  </div>
                )
              ))}
              {error && <p style={S.error}>{error}</p>}
            </div>

            {/* footer / composer */}
            <div style={S.footer}>
              <div style={S.composer}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                  placeholder="Ask anything about this task…" rows={1} style={S.input} />
                <button onClick={send} disabled={!input.trim() || streaming} style={S.sendBtn} aria-label="Send">
                  {streaming ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                </button>
              </div>
              <button onClick={clearChat} style={S.clearBtn}><RotateCcw size={13} /> Clear chat</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 70 },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', zIndex: 71,
    background: 'rgba(17,17,17,0.96)', backdropFilter: 'saturate(180%) blur(24px)',
    borderLeft: '1px solid var(--d-line)', display: 'flex', flexDirection: 'column',
    color: 'var(--d-text)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 22px 16px', borderBottom: '1px solid var(--d-line)' },
  context: { color: 'var(--d-text-dim)', fontSize: '0.82rem', lineHeight: 1.45, marginTop: 6,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  x: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', display: 'grid', placeItems: 'center', padding: 4, flexShrink: 0, cursor: 'pointer' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '85%', background: 'var(--red)', color: '#fff', padding: '10px 14px',
    borderRadius: '16px 16px 4px 16px', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  aiRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  aiCard: { maxWidth: '92%', background: 'var(--d-card)', border: '1px solid var(--d-line)', color: 'var(--d-text)',
    padding: '12px 15px', borderRadius: '16px 16px 16px 4px', fontSize: '0.92rem', lineHeight: 1.6 },
  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent',
    border: '1px solid var(--d-line)', color: 'var(--d-text-dim)', fontSize: '0.74rem', fontWeight: 600,
    padding: '4px 10px', borderRadius: 50, cursor: 'pointer' },
  error: { color: 'var(--red)', fontSize: '0.82rem', margin: 0 },
  footer: { borderTop: '1px solid var(--d-line)', padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  composer: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 140, resize: 'none', background: 'var(--d-bg)', color: 'var(--d-text)',
    border: '1px solid var(--d-line)', borderRadius: 12, padding: '11px 14px', fontSize: '0.93rem',
    lineHeight: 1.4, outline: 'none', fontFamily: 'inherit' },
  sendBtn: { flexShrink: 0, width: 42, height: 42, borderRadius: 12, background: 'var(--red)', color: '#fff',
    border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' },
  clearBtn: { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent',
    border: 'none', color: 'var(--d-text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: '2px 0' },
}
