import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail } from 'lucide-react'
import { pageVariants } from '../motion'

/**
 * Shared layout for the Privacy and Terms pages. Clean white, matches the landing.
 * sections: [{ title, body: string[] }]
 */
export default function LegalPage({ title, updated, intro, sections = [] }) {
  const nav = useNavigate()
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" style={S.shell}>
      <div style={S.inner}>
        <button onClick={() => nav('/')} style={S.logo}>STRYKD</button>

        <h1 className="h-xl display" style={{ marginTop: 32 }}>{title}</h1>
        <p style={S.updated}>Last updated: {updated}</p>
        {intro && <p style={S.intro}>{intro}</p>}

        {sections.map((s, i) => (
          <section key={i} style={{ marginTop: 36 }}>
            <h2 className="display" style={S.h2}>{s.title}</h2>
            {s.body.map((p, j) => <p key={j} style={S.p}>{p}</p>)}
          </section>
        ))}

        <div style={S.foot}>
          <a href="mailto:hello@strykdapp.com" style={S.link}><Mail size={15} /> hello@strykdapp.com</a>
          <button onClick={() => nav('/')} style={S.back}><ArrowLeft size={15} /> Back to home</button>
        </div>
      </div>
    </motion.div>
  )
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--white)', color: 'var(--ink)', padding: '56px 24px' },
  inner: { maxWidth: 720, margin: '0 auto' },
  logo: { background: 'none', border: 'none', fontWeight: 800, letterSpacing: '0.14em', fontSize: '1.05rem', color: 'var(--ink)', cursor: 'pointer' },
  updated: { color: 'var(--gray-light)', fontSize: '0.85rem', fontWeight: 600, marginTop: 14 },
  intro: { color: 'var(--gray-text)', fontSize: '1.02rem', lineHeight: 1.65, marginTop: 20 },
  h2: { fontSize: '1.35rem', marginBottom: 10 },
  p: { color: 'var(--gray-text)', fontSize: '0.98rem', lineHeight: 1.7, marginBottom: 12 },
  foot: { marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--gray-line)', display: 'flex',
    gap: 24, alignItems: 'center', flexWrap: 'wrap' },
  link: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--gray-text)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' },
}
