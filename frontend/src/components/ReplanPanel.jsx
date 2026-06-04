import { useState } from 'react'
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
    setPreview('')
    setDone(false)
    setError('')
    setStreaming(true)

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

        // Parse complete SSE messages
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6)
            if (raw === '[DONE]') { setDone(true); setStreaming(false); return }
            try {
              setPreview(p => p + JSON.parse(raw))
            } catch {
              setPreview(p => p + raw)
            }
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
    // Parse preview lines into task objects
    const tasks = preview
      .split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
      .map(content => ({ content, voice_style: 'direct' }))

    try {
      await api.replanConfirm({ goal_id: goalId, task_date: taskDate, tasks })
      setPreview('')
      setRequest('')
      setDone(false)
      setOpen(false)
      onConfirmed && onConfirmed()
    } catch (e) {
      setError(e.message)
    }
  }

  const s = {
    panel: {
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: '1.5rem',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.9rem 1.25rem',
      background: 'var(--bg-card)',
      cursor: 'pointer',
      userSelect: 'none',
    },
    body: { padding: '1.25rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' },
    textarea: {
      width: '100%',
      minHeight: 80,
      padding: '0.75rem',
      background: 'var(--bg)',
      color: 'var(--fg)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      resize: 'vertical',
      fontSize: '0.9rem',
      outline: 'none',
    },
    btn: (variant = 'primary') => ({
      padding: '0.6rem 1.2rem',
      background: variant === 'primary' ? 'var(--accent)' : 'transparent',
      color: variant === 'primary' ? '#fff' : 'var(--fg-dim)',
      border: `1px solid ${variant === 'primary' ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      fontWeight: 600,
      fontSize: '0.85rem',
      opacity: streaming ? 0.5 : 1,
    }),
    preview: {
      marginTop: '1rem',
      padding: '0.9rem',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      fontSize: '0.88rem',
      lineHeight: 1.65,
      color: 'var(--fg)',
      whiteSpace: 'pre-wrap',
      minHeight: 60,
    },
  }

  return (
    <div style={s.panel}>
      <div style={s.header} onClick={() => setOpen(o => !o)}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          ✦ Replan with AI
        </span>
        <span style={{ color: 'var(--fg-dim)', fontSize: '0.85rem' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div style={s.body}>
          <p style={{ fontSize: '0.82rem', color: 'var(--fg-dim)', marginBottom: '0.75rem' }}>
            Describe what you want to change about today's tasks.
          </p>

          <textarea
            style={s.textarea}
            placeholder="e.g. Make the morning tasks lighter, I only have 30 minutes..."
            value={request}
            onChange={e => setRequest(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.metaKey && submit()}
          />

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button style={s.btn('primary')} onClick={submit} disabled={streaming}>
              {streaming ? 'Thinking…' : 'Generate preview'}
            </button>
            {preview && !streaming && (
              <button style={s.btn('secondary')} onClick={() => { setPreview(''); setDone(false) }}>
                Clear
              </button>
            )}
          </div>

          {error && (
            <p style={{ color: '#E85D04', fontSize: '0.82rem', marginTop: '0.5rem' }}>{error}</p>
          )}

          {(preview || streaming) && (
            <div style={s.preview}>
              {preview || <span style={{ color: 'var(--fg-muted)' }}>Generating…</span>}
              {streaming && <span style={{ opacity: 0.5 }}>█</span>}
            </div>
          )}

          {done && preview && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                style={{ ...s.btn('primary'), background: '#2ECC71', borderColor: '#2ECC71' }}
                onClick={confirm}
              >
                ✓ Apply changes
              </button>
              <button style={s.btn('secondary')} onClick={() => { setPreview(''); setDone(false) }}>
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
