import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
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
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Stream failed')
      }
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
            try { setPreview(p => p + JSON.parse(raw)) }
            catch { setPreview(p => p + raw) }
          }
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setStreaming(false)
    }
  }

  const confirm = async () => {
    if (!preview.trim()) return
    const tasks = preview.split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '').trim())
      .filter(Boolean)
      .map(content => ({ content, voice_style: 'direct' }))
    try {
      await api.replanConfirm({ goal_id: goalId, task_date: taskDate, tasks })
      setPreview(''); setRequest(''); setDone(false); setOpen(false)
      onConfirmed && onConfirmed()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', marginTop: '1.5rem' }}>
      <button onClick={() => setOpen(o => !o)} style={S.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, fontSize: '0.92rem' }}>
          <Sparkles size={17} color="var(--blue)" /> Replan with AI
        </span>
        {open ? <ChevronUp size={17} color="var(--text-muted)" /> : <ChevronDown size={17} color="var(--text-muted)" />}
      </button>

      {open && (
        <div style={S.body}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
            Describe what to change about today's tasks.
          </p>
          <textarea className="field" style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="e.g. Make the morning lighter, I only have 30 minutes…"
            value={request} onChange={e => setRequest(e.target.value)}
            onKeyDown={e => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()} />

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="pill pill-blue pill-sm" onClick={submit} disabled={streaming}>
              {streaming ? 'Thinking…' : 'Generate preview'}
            </button>
            {preview && !streaming && (
              <button className="pill pill-outline pill-sm" onClick={() => { setPreview(''); setDone(false) }}>
                Clear
              </button>
            )}
          </div>

          {error && <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginTop: '0.5rem' }}>{error}</p>}

          {(preview || streaming) && (
            <div style={S.preview}>
              {preview || <span style={{ color: 'var(--text-muted)' }}>Generating…</span>}
              {streaming && <span className="cursor-blink">▋</span>}
            </div>
          )}

          {done && preview && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button className="pill pill-red pill-sm" onClick={confirm}>
                <Check size={15} /> Apply changes
              </button>
              <button className="pill pill-outline pill-sm" onClick={() => { setPreview(''); setDone(false) }}>
                <X size={15} /> Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  header: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.95rem 1.25rem', background: 'transparent', border: 'none', color: 'var(--white)',
  },
  body: { padding: '1.25rem', borderTop: '1px solid var(--line)' },
  preview: {
    marginTop: '1rem', padding: '0.9rem 1rem', background: 'var(--black)',
    border: '1px solid var(--line)', borderRadius: 10, fontSize: '0.88rem',
    lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', minHeight: 60,
  },
}
