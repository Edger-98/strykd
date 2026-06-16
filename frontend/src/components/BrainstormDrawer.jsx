import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, ArrowUp, Plus, Check, RotateCcw } from 'lucide-react'
import { api } from '../api'

const opening = task => ({
  role: 'assistant',
  content:
    `I can see you're working on: ${task?.content || 'this task'}. What would you like help with? ` +
    'I can break this down, give examples, help you brainstorm, or talk through any blockers.',
})

// Belt-and-suspenders markdown strip (the server strips too): drop # * | and
// collapse blank lines, so AI text reads like a plain message.
const stripMd = s => (s || '').replace(/[#*|]/g, '').replace(/\n{2,}/g, '\n').replace(/^\s+/, '')

/**
 * Right-side AI chat drawer scoped to a single task, styled like iMessage.
 * Streams responses via SSE. Conversation lives in local state only.
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
  const [saved, setSaved] = useState({})
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

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
      await api.addQuickTask(stripMd(content).trim())
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

  const drawerStyle = isMobile
    ? { ...S.drawer, left: 0, right: 0, bottom: 0, top: 'auto', height: '85vh', width: '100%',
        borderLeft: 'none', borderTop: '1px solid var(--d-line)', borderRadius: '20px 20px 0 0' }
    : { ...S.drawer, top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)' }
  const enter = isMobile
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div onClick={onClose} style={S.backdrop}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div style={drawerStyle} {...enter}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}>

            {/* header */}
            <div style={S.head}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <Sparkles size={17} color="var(--red)" /> AI Assistant
                </span>
                <p style={S.context} title={task.content}>{task.content}</p>
              </div>
              <button onClick={onClose} style={S.x} aria-label="Close"><X size={18} /></button>
            </div>

            {/* messages */}
            <div ref={scrollRef} style={S.messages}>
              {messages.map((m, i) => {
                if (m.role === 'user') {
                  return (
                    <div key={i} style={S.userRow}>
                      <div style={S.userBubble}>{m.content}</div>
                    </div>
                  )
                }
                const isLast = i === messages.length - 1
                const text = stripMd(m.content)
                return (
                  <div key={i} style={S.aiRow}>
                    <div style={S.aiBubble}>
                      {text || (streaming && isLast)
                        ? (text || <TypingDots />)
                        : <TypingDots />}
                    </div>
                    {/* Save-as-task on completed AI answers (not the opening greeting) */}
                    {i > 0 && text && !(streaming && isLast) && (
                      <button onClick={() => saveAsTask(m.content, i)} disabled={saved[i]} style={S.saveBtn}>
                        {saved[i] ? <><Check size={12} /> Saved</> : <><Plus size={12} /> Save as task</>}
                      </button>
                    )}
                  </div>
                )
              })}
              {error && <p style={S.error}>{error}</p>}
            </div>

            {/* composer (fixed at bottom) */}
            <div style={S.footer}>
              <div style={S.composer}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                  placeholder="Message" rows={1} style={S.input} />
                <button onClick={send} disabled={!input.trim() || streaming} style={{ ...S.sendBtn, opacity: (!input.trim() || streaming) ? 0.4 : 1 }} aria-label="Send">
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
              <button onClick={clearChat} style={S.clearBtn}><RotateCcw size={12} /> Clear chat</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 2px' }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#8E8E93' }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }} />
      ))}
    </span>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', zIndex: 70 },
  drawer: {
    position: 'fixed', zIndex: 71,
    background: 'rgba(14,14,14,0.97)', backdropFilter: 'saturate(180%) blur(24px)',
    borderLeft: '1px solid var(--d-line)', display: 'flex', flexDirection: 'column',
    color: 'var(--d-text)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
  },
  head: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid var(--d-line)' },
  context: { color: 'var(--d-text-dim)', fontSize: '0.8rem', lineHeight: 1.45, marginTop: 5,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  x: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', display: 'grid', placeItems: 'center', padding: 4, flexShrink: 0, cursor: 'pointer' },
  messages: { flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '80%', background: 'var(--red)', color: '#fff', padding: '9px 14px',
    borderRadius: '20px 20px 5px 20px', fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  aiRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7 },
  aiBubble: { maxWidth: '85%', background: '#fff', color: '#111', padding: '10px 14px',
    borderRadius: '20px 20px 20px 5px', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  saveBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent',
    border: '1px solid var(--d-line)', color: 'var(--d-text-dim)', fontSize: '0.72rem', fontWeight: 600,
    padding: '4px 10px', borderRadius: 50, cursor: 'pointer', marginLeft: 4 },
  error: { color: 'var(--red)', fontSize: '0.82rem', margin: 0 },
  footer: { borderTop: '1px solid var(--d-line)', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    background: 'rgba(14,14,14,0.6)' },
  composer: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 130, resize: 'none', background: 'var(--d-bg)', color: 'var(--d-text)',
    border: '1px solid var(--d-line)', borderRadius: 22, padding: '10px 16px', fontSize: '14px',
    lineHeight: 1.4, outline: 'none', fontFamily: 'inherit' },
  sendBtn: { flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: 'var(--red)', color: '#fff',
    border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'opacity 0.15s' },
  clearBtn: { alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent',
    border: 'none', color: 'var(--d-text-muted)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', padding: '2px 0' },
}
