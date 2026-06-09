import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft } from 'lucide-react'
import { pageVariants } from '../motion'

const EMAIL = 'hello@strykdapp.com'

export default function Contact() {
  const nav = useNavigate()
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" style={S.shell}>
      <div style={S.inner}>
        <button onClick={() => nav('/')} style={S.logo}>STRYKD</button>

        <h1 className="h-xl display" style={{ marginTop: 40 }}>Get in touch</h1>
        <p className="lead" style={{ maxWidth: 460, margin: '18px auto 36px' }}>
          We'd love to hear from you. Questions, feedback, or just to say hello.
        </p>

        <a href={`mailto:${EMAIL}`} className="pill pill-dark pill-lg" style={{ display: 'inline-flex' }}>
          <Mail size={18} /> {EMAIL}
        </a>

        <div style={{ marginTop: 48 }}>
          <button onClick={() => nav('/')} style={S.back}><ArrowLeft size={15} /> Back to home</button>
        </div>
      </div>
    </motion.div>
  )
}

const S = {
  shell: { minHeight: '100vh', background: 'var(--white)', color: 'var(--ink)', display: 'grid', placeItems: 'center', padding: '40px 24px', textAlign: 'center' },
  inner: { maxWidth: 560 },
  logo: { background: 'none', border: 'none', fontWeight: 800, letterSpacing: '0.14em', fontSize: '1.05rem', color: 'var(--ink)', cursor: 'pointer' },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--gray-text)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' },
}
