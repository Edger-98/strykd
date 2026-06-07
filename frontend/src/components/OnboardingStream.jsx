import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { api } from '../api'

const STAGES = ['analyzing', 'chapters', 'tasks', 'mission', 'theme', 'signal']
const TOTAL = STAGES.length

const fmt = secs => {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Full-screen cinematic loading experience for plan generation. Streams the
 * onboarding SSE endpoint and reveals one progress line per completed stage,
 * a thin red bar filling 1/6 per stage, then "Your plan is ready." and redirect.
 */
export default function OnboardingStream({ form, onDone, onCancel }) {
  const [lines, setLines] = useState([])   // { event, message, t }
  const [completed, setCompleted] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const startRef = useRef(0)
  const abortRef = useRef(null)
  const runningRef = useRef(false)

  const run = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setLines([]); setCompleted(0); setReady(false); setError('')
    startRef.current = Date.now()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await api.onboardStream(form)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Generation failed')
      }
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
          for (const ln of part.split('\n')) {
            if (!ln.startsWith('data: ')) continue
            let ev
            try { ev = JSON.parse(ln.slice(6)) } catch { continue }
            const t = (Date.now() - startRef.current) / 1000

            if (ev.event === 'error') { setError(ev.message || 'Generation failed'); return }
            if (ev.event === 'done') {
              setCompleted(TOTAL)
              setReady(true)
              setTimeout(() => onDone(ev.data), 1900)
              return
            }
            if (STAGES.includes(ev.event)) {
              setLines(prev => [...prev, { event: ev.event, message: ev.message, t }])
              setCompleted(prev => Math.min(prev + 1, TOTAL))
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Generation failed')
    } finally {
      runningRef.current = false
    }
  }

  useEffect(() => {
    run()
    return () => { abortRef.current?.abort(); runningRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pct = ready ? 100 : (completed / TOTAL) * 100

  return (
    <div style={S.shell}>
      {/* thin red progress bar */}
      <div style={S.track}>
        <motion.div style={S.fill} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} />
      </div>

      <div style={S.inner}>
        <p style={S.eyebrow}>BUILDING YOUR PLAN</p>
        <h1 style={S.goal}>{form.goals}</h1>

        <div style={S.lines}>
          <AnimatePresence>
            {lines.map((l, i) => (
              <motion.div key={l.event + i} style={S.line}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <Check size={15} color="var(--red)" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }} />
                <span style={S.ts}>{fmt(l.t)}</span>
                <span style={S.msg}>{l.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {ready && (
            <motion.h2 style={S.ready} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
              Your plan is ready.
            </motion.h2>
          )}

          {!ready && !error && (
            <div style={S.caretRow}>
              <span style={S.caret} />
            </div>
          )}

          {error && (
            <motion.div style={S.errBox} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p style={{ color: '#FF6B6B', marginBottom: 16 }}>{error}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="pill pill-white pill-sm" onClick={run}>Try again <ArrowRight size={15} /></button>
                {onCancel && <button className="pill pill-outline pill-sm" onClick={onCancel} style={S.cancel}>Edit answers</button>}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  shell: { position: 'fixed', inset: 0, background: '#000', color: '#fff', overflowY: 'auto', zIndex: 100 },
  track: { position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', zIndex: 101 },
  fill: { height: '100%', background: 'var(--red)', boxShadow: '0 0 12px rgba(255,45,45,0.7)' },
  inner: { maxWidth: 720, margin: '0 auto', padding: 'clamp(64px, 14vh, 160px) 28px 80px' },
  eyebrow: { fontSize: '0.78rem', letterSpacing: '0.22em', fontWeight: 700, color: '#5C5C5C', marginBottom: 18 },
  goal: { fontSize: 'clamp(1.9rem, 5vw, 3.2rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em',
    color: '#fff', marginBottom: 'clamp(40px, 8vh, 72px)' },
  lines: { display: 'flex', flexDirection: 'column', gap: 18 },
  line: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  ts: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem', color: '#5C5C5C',
    minWidth: 42, flexShrink: 0, marginTop: 2 },
  msg: { fontSize: '1.05rem', lineHeight: 1.5, color: '#fff' },
  ready: { fontSize: 'clamp(1.7rem, 4.5vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.02em',
    marginTop: 28, color: '#fff', textShadow: '0 0 30px rgba(255,45,45,0.35)' },
  caretRow: { display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 1 },
  caret: { width: 9, height: 18, background: 'var(--red)', display: 'inline-block',
    animation: 'blink 1.1s step-end infinite', borderRadius: 1 },
  errBox: { marginTop: 12 },
  cancel: { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' },
}
