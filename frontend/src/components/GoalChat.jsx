import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Check, Pencil } from 'lucide-react'
import { api } from '../api'

const OPENING = "What do you want to achieve? Don't worry about being specific yet. Just tell me what's on your mind."
const FINAL_INTRO = "Perfect. I have everything I need to build your plan. Here's how I'm framing your goal:"

/**
 * Goal-clarification chat for onboarding Step 1. Dark iMessage-style panel:
 * AI bubbles left (with a Strykd avatar), user bubbles right in red. Drives a
 * 3-5 turn clarify loop and, on approval, calls onApprove(refinedGoal).
 */
export default function GoalChat({ lifeArea, initialGoal, onApprove }) {
  const hasInitial = !!(initialGoal && initialGoal.trim())
  const [messages, setMessages] = useState(
    hasInitial
      ? [{ role: 'ai', content: FINAL_INTRO, goal: initialGoal, refined: true }]
      : [{ role: 'ai', content: OPENING }]
  )
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [phase, setPhase] = useState(hasInitial ? 'refined' : 'chat') // 'chat' | 'refined'
  const [refinedGoal, setRefinedGoal] = useState(initialGoal || '')
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, typing, phase])

  const apiHistory = msgs => msgs.map(m => ({ role: m.role, content: m.goal ? `${m.content} ${m.goal}` : m.content }))

  const send = async () => {
    const text = input.trim()
    if (!text || typing) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setTyping(true); setError('')
    try {
      const res = await api.clarify(apiHistory(next), lifeArea || undefined)
      if (res.type === 'refined') {
        const goal = res.refined_goal || res.message
        setRefinedGoal(goal)
        setMessages([...next, { role: 'ai', content: FINAL_INTRO, goal, refined: true }])
        setPhase('refined')
      } else {
        setMessages([...next, { role: 'ai', content: res.message }])
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
    } finally {
      setTyping(false)
    }
  }

  const adjust = () => {
    setPhase('chat')
    setMessages(m => [...m, { role: 'ai', content: 'No problem. Tell me what you would like to change or add.' }])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <div style={S.panel}>
      <div style={S.scroll}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ ...S.row, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'ai' && <span style={S.avatar}>S</span>}
              <div style={m.role === 'user' ? S.userBubble : S.aiBubble}>
                <span>{m.content}</span>
                {m.refined && m.goal && (
                  <p style={S.refinedGoal}>{m.goal}</p>
                )}
              </div>
            </motion.div>
          ))}

          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...S.row, justifyContent: 'flex-start' }}>
              <span style={S.avatar}>S</span>
              <div style={S.aiBubble}><TypingDots /></div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p style={S.err}>{error}</p>}
        <div ref={endRef} />
      </div>

      {phase === 'refined' ? (
        <div style={S.actions}>
          <button className="pill pill-red" style={{ flex: 1 }} onClick={() => onApprove(refinedGoal)}>
            <Check size={16} /> This is right, build my plan
          </button>
          <button className="pill" style={S.adjustBtn} onClick={adjust}>
            <Pencil size={14} /> Let me adjust this
          </button>
        </div>
      ) : (
        <div style={S.inputRow}>
          <textarea ref={inputRef} autoFocus rows={1} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={onKey} placeholder="Type your answer..." style={S.input} disabled={typing} />
          <button onClick={send} disabled={!input.trim() || typing} aria-label="Send"
            style={{ ...S.send, opacity: !input.trim() || typing ? 0.4 : 1 }}>
            <ArrowUp size={18} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--d-text-muted)' }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
      ))}
    </span>
  )
}

const S = {
  panel: { display: 'flex', flexDirection: 'column', background: '#000', borderRadius: 20,
    border: '1px solid var(--d-line)', height: 'clamp(380px, 56vh, 540px)', overflow: 'hidden' },
  scroll: { flex: 1, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  avatar: { flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--red)', color: '#fff',
    fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.02em', display: 'grid', placeItems: 'center', marginBottom: 2 },
  aiBubble: { maxWidth: '78%', background: 'var(--d-card)', color: 'var(--d-text)', borderRadius: '16px 16px 16px 4px',
    padding: '11px 14px', fontSize: '0.95rem', lineHeight: 1.5 },
  userBubble: { maxWidth: '78%', background: 'var(--red)', color: '#fff', borderRadius: '16px 16px 4px 16px',
    padding: '11px 14px', fontSize: '0.95rem', lineHeight: 1.5 },
  refinedGoal: { marginTop: 10, fontWeight: 700, lineHeight: 1.45, color: '#fff' },
  err: { color: '#FF6B6B', fontSize: '0.85rem', padding: '4px 6px' },
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12, borderTop: '1px solid var(--d-line)' },
  input: { flex: 1, resize: 'none', maxHeight: 120, background: 'var(--d-card)', color: 'var(--d-text)',
    border: '1px solid var(--d-line)', borderRadius: 18, padding: '11px 14px', fontSize: '0.95rem',
    outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 },
  send: { flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: 'var(--red)', border: 'none',
    display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'opacity 0.15s' },
  actions: { display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderTop: '1px solid var(--d-line)' },
  adjustBtn: { background: 'transparent', color: 'var(--d-text-dim)', border: '1px solid var(--d-line)' },
}
