import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Check } from 'lucide-react'
import { api } from '../api'

export default function ReplanPanel({ goalId, taskDate, onConfirmed }) {
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState('')
  const [preview, setPreview] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!request.trim() || streaming) return
    setPreview(''); setDone(false); setError(''); setStreaming(true)
    try {
      const res = await api.replanStream(request.trim())
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Stream failed') }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done: d, value } = await reader.read()
        if (d) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            if (raw === '[DONE]') { setDone(true); setStreaming(false); return }
            try { setPreview(p => p + JSON.parse(raw)) } catch { setPreview(p => p + raw) }
          }
        }
      }
    } catch (e) { setError(e.message) } finally { setStreaming(false) }
  }

  const confirm = async () => {
    if (!preview.trim()) return
    const tasks = preview.split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '').trim())
      .filter(Boolean).map(content => ({ content, voice_style: 'direct' }))
    try {
      await api.replanConfirm({ goal_id: goalId, task_date: taskDate, tasks })
      setPreview(''); setRequest(''); setDone(false); setOpen(false)
      onConfirmed && onConfirmed()
    } catch (e) { setError(e.message) }
  }

  return (
    <>
      {/* trigger */}
      <button onClick={() => setOpen(true)} className="pill pill-blue" style={{ marginTop: 28 }}>
        <Sparkles size={16} /> Replan with AI
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div onClick={() => setOpen(false)} style={S.backdrop}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div style={S.drawer}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
              <div style={S.head}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <Sparkles size={18} color="var(--blue)" /> Replan with AI
                </span>
                <button onClick={() => setOpen(false)} style={S.x}><X size={18} /></button>
              </div>

              <p style={{ color: 'var(--d-text-dim)', fontSize: '0.88rem', marginBottom: 14 }}>
                Describe what to change about today's tasks.
              </p>
              <textarea style={S.textarea} placeholder="e.g. Make the morning lighter, I only have 30 minutes…"
                value={request} onChange={e => setRequest(e.target.value)}
                onKeyDown={e => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()} />

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="pill pill-blue pill-sm" onClick={submit} disabled={streaming}>
                  {streaming ? 'Thinking…' : 'Generate preview'}
                </button>
                {preview && !streaming && (
                  <button className="pill pill-outline pill-sm" style={{ color: 'var(--d-text)', borderColor: 'var(--d-line)' }}
                    onClick={() => { setPreview(''); setDone(false) }}>Clear</button>
                )}
              </div>

              {error && <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginTop: 10 }}>{error}</p>}

              {(preview || streaming) && (
                <div style={S.preview}>
                  {preview || <span style={{ color: 'var(--d-text-muted)' }}>Generating…</span>}
                  {streaming && <span style={{ animation: 'blink 1s step-end infinite' }}>▋</span>}
                </div>
              )}

              {done && preview && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                  <button className="pill pill-red pill-sm" onClick={confirm}><Check size={15} /> Apply changes</button>
                  <button className="pill pill-outline pill-sm" style={{ color: 'var(--d-text)', borderColor: 'var(--d-line)' }}
                    onClick={() => { setPreview(''); setDone(false) }}>Discard</button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 60 },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 92vw)', zIndex: 61,
    background: 'rgba(17,17,17,0.92)', backdropFilter: 'saturate(180%) blur(24px)',
    borderLeft: '1px solid var(--d-line)', padding: 28, overflowY: 'auto', color: 'var(--d-text)',
    boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  x: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', display: 'grid', placeItems: 'center', padding: 4 },
  textarea: {
    width: '100%', minHeight: 90, resize: 'vertical', background: 'var(--d-bg)', color: 'var(--d-text)',
    border: '1px solid var(--d-line)', borderRadius: 12, padding: '12px 14px', fontSize: '0.95rem', outline: 'none',
  },
  preview: {
    marginTop: 16, padding: '14px 16px', background: 'var(--d-bg)', border: '1px solid var(--d-line)',
    borderRadius: 12, fontSize: '0.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', minHeight: 60,
  },
}
