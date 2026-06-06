import { useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UploadCloud, X, CheckCircle2, AlertTriangle, Loader2, Film } from 'lucide-react'
import { api } from '../api'

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4']

/**
 * Upload a daily visual proof for a task. AI tasks (with a goal) run through the
 * vision review + auto-complete endpoint; quick tasks just attach the file.
 */
export default function ProofModal({ open, task, onClose, onResult }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isVideo, setIsVideo] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!open) {
      // reset on close
      setFile(null); setPreview(null); setIsVideo(false)
      setBusy(false); setError(''); setResult(null); setDragOver(false)
    }
  }, [open])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (!open || !task) return null

  const pick = f => {
    setError('')
    if (!f) return
    if (!ACCEPT.includes(f.type)) { setError('Upload a JPG, PNG, or MP4 file.'); return }
    if (f.size > MAX_BYTES) { setError('File must be 50MB or smaller.'); return }
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setIsVideo(f.type.startsWith('video'))
    setPreview(URL.createObjectURL(f))
  }

  const onDrop = e => {
    e.preventDefault(); setDragOver(false)
    pick(e.dataTransfer.files?.[0])
  }

  const submit = async () => {
    if (!file || busy) return
    setBusy(true); setError('')
    try {
      let res
      if (task.goal_id) {
        res = await api.uploadDailyProof(task.goal_id, file)
        setResult(res.review || { verified: false, confidence: 'low', comment: 'Proof submitted.' })
      } else {
        await api.uploadTaskProof(task.id, file)
        setResult({ verified: true, confidence: 'high', comment: 'Proof attached.', _noReview: true })
      }
      onResult && onResult()
    } catch (e) {
      setError(e.message || 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const verified = result && result.verified
  const goodConf = result && (result.confidence === 'high' || result.confidence === 'medium')
  const accepted = result && (result._noReview || (verified && goodConf))

  return (
    <AnimatePresence>
      <motion.div style={S.backdrop} onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div style={S.modal} onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
          <div style={S.head}>
            <div>
              <p style={S.eyebrow}>DAILY PROOF</p>
              <h2 style={S.title}>Submit proof</h2>
            </div>
            <button onClick={onClose} style={S.icon} aria-label="Close"><X size={18} /></button>
          </div>

          <p style={S.taskLine}>{task.content}</p>

          {result ? (
            <div style={{
              ...S.resultCard,
              background: accepted ? 'rgba(52,199,89,0.1)' : 'rgba(255,159,10,0.1)',
              border: `1px solid ${accepted ? '#34C759' : '#FF9F0A'}`,
            }}>
              {accepted
                ? <CheckCircle2 size={22} color="#34C759" style={{ flexShrink: 0 }} />
                : <AlertTriangle size={22} color="#FF9F0A" style={{ flexShrink: 0 }} />}
              <div>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>
                  {accepted
                    ? (result._noReview ? 'Proof attached' : 'Verified')
                    : 'Not verified yet'}
                  {!result._noReview && result.confidence && (
                    <span style={S.confTag}>{result.confidence} confidence</span>
                  )}
                </p>
                <p style={{ color: 'var(--d-text-dim)', fontSize: '0.9rem', lineHeight: 1.5 }}>{result.comment}</p>
              </div>
            </div>
          ) : (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{ ...S.drop, borderColor: dragOver ? 'var(--blue)' : 'var(--d-line)',
                  background: dragOver ? 'rgba(0,113,227,0.06)' : 'var(--d-bg)' }}>
                {preview ? (
                  isVideo
                    ? <video src={preview} style={S.previewMedia} controls />
                    : <img src={preview} alt="proof preview" style={S.previewMedia} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--d-text-muted)' }}>
                    <UploadCloud size={32} style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: '0.92rem', color: 'var(--d-text-dim)' }}>Drag and drop, or click to upload</p>
                    <p style={{ fontSize: '0.78rem', marginTop: 4 }}>JPG, PNG, or MP4, up to 50MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,video/mp4"
                  onChange={e => pick(e.target.files?.[0])} style={{ display: 'none' }} />
              </div>

              {file && (
                <p style={S.fileName}>
                  {isVideo && <Film size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}
                  {file.name}
                </p>
              )}
              {error && <p style={S.err}>{error}</p>}

              <button className="pill pill-blue" onClick={submit} disabled={!file || busy} style={{ width: '100%', marginTop: 16 }}>
                {busy ? <><Loader2 size={16} className="spin-icon" /> {task.goal_id ? 'Analyzing…' : 'Uploading…'}</> : 'Submit proof'}
              </button>
            </>
          )}

          {result && (
            <button className="pill pill-dark" onClick={onClose} style={{ width: '100%', marginTop: 16 }}>Done</button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
    zIndex: 70, display: 'grid', placeItems: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 460, background: 'var(--d-panel)', border: '1px solid var(--d-line)',
    borderRadius: 20, padding: 24, color: 'var(--d-text)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  eyebrow: { fontSize: '0.7rem', letterSpacing: '0.14em', fontWeight: 700, color: 'var(--d-text-muted)' },
  title: { fontSize: '1.3rem', fontWeight: 800, marginTop: 4 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  taskLine: { color: 'var(--d-text-dim)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 16,
    paddingBottom: 16, borderBottom: '1px solid var(--d-line)' },
  drop: { borderRadius: 14, border: '2px dashed var(--d-line)', minHeight: 180, display: 'grid',
    placeItems: 'center', cursor: 'pointer', padding: 16, transition: 'all 0.15s' },
  previewMedia: { maxWidth: '100%', maxHeight: 240, borderRadius: 10, objectFit: 'contain' },
  fileName: { fontSize: '0.82rem', color: 'var(--d-text-dim)', marginTop: 10, wordBreak: 'break-all' },
  err: { color: 'var(--red)', fontSize: '0.85rem', marginTop: 10 },
  resultCard: { display: 'flex', gap: 12, padding: 16, borderRadius: 14, alignItems: 'flex-start' },
  confTag: { marginLeft: 8, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: 'var(--d-text-muted)', border: '1px solid var(--d-line)', borderRadius: 50, padding: '2px 8px' },
}
