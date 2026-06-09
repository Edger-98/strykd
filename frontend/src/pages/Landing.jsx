import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Star, Target, Sparkles, Globe, Zap,
  CheckCircle2, TrendingUp, Loader2, Users, Calendar,
} from 'lucide-react'
import { pageVariants, revealVariants, staggerContainer, staggerItem, inView } from '../motion'
import { api, setToken } from '../api'

const HERO_PHOTO = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1440&q=80'
const BAND_PHOTO = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1440&q=80'

const STEPS = [
  { n: '01', t: 'Tell us your goal', d: 'Answer a few honest questions about what you want and what has stopped you before.' },
  { n: '02', t: 'AI builds your plan', d: 'Get a personalized day-by-day plan, a visual identity, and a live page in seconds.' },
  { n: '03', t: 'Show up daily', d: 'Check off tasks, keep your streak alive, and replan with AI whenever life shifts.' },
  { n: '04', t: 'Invite others', d: 'Share your page or collaborate on a list. Accountability works better together.' },
]

const REVIEWS = [
  { name: 'Marcus Webb', age: 31, city: 'Chicago', goal: 'Lost 22 lbs',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&fit=crop&crop=faces',
    quote: "I'd started over more times than I can count. Strykd was the first thing that didn't let me disappear. 22 pounds down and the streak is still alive." },
  { name: 'Priya Nair', age: 28, city: 'San Francisco', goal: 'Promoted to Senior Engineer',
    img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&fit=crop&crop=faces',
    quote: "It broke 'get promoted' into something I could actually do every morning. Twelve weeks later I had the title and the receipts to back it up." },
  { name: 'James Okafor', age: 24, city: 'Atlanta', goal: 'Launched his app · 50 users',
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&fit=crop&crop=faces',
    quote: "The replan button saved me. Every time I wanted to quit, it rebuilt the week instead of letting me ghost. Shipped, and got my first 50 users." },
  { name: 'Sofia Reyes', age: 26, city: 'Miami', goal: 'Finished her first novel',
    img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&fit=crop&crop=faces',
    quote: "90,000 words I never thought I had. Seeing my page and that streak counter every day made the book feel real before it was real." },
  { name: 'Daniel Park', age: 33, city: 'Seattle', goal: '90 days clean',
    img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80&fit=crop&crop=faces',
    quote: "One day at a time, but with something watching that actually cared if I showed up. Day 90 hit different. This gave me a spine when I had none." },
]

const FEATURES = [
  { Icon: Sparkles, t: 'AI-built daily plans', d: 'A coach that turns any goal into concrete daily tasks, tuned to your hours and your blockers.' },
  { Icon: TrendingUp, t: 'Streaks that hold you', d: 'A streak counter and signal wall that make not showing up feel like a real loss.' },
  { Icon: Globe, t: 'Your own live page', d: 'A shareable page on your own subdomain, with your mission, progress, and daily wins, public or private.' },
  { Icon: Zap, t: 'Replan in real time', d: 'Life shifts. Tell the AI what changed and watch your plan rewrite itself, live.' },
  { Icon: Users, t: 'Collaborative lists', d: 'Plan trips, events, and projects with anyone. Share a link, no account needed.' },
  { Icon: Calendar, t: 'Calendar sync', d: 'Add any task to Google or Apple Calendar in one tap. Your plan, in your day.' },
]

export default function Landing() {
  const nav = useNavigate()
  const [view, setView] = useState('hero')
  const [form, setForm] = useState({ email: '', password: '', name: '', slug: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const res = view === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form)
      setToken(res.access_token)
      nav(view === 'login' ? '/dashboard' : '/onboard')
    } catch (err) { setError(err.message); setBusy(false) }
  }

  if (view === 'forgot') {
    return <ForgotView email={form.email} setEmail={e => setForm(f => ({ ...f, email: e }))}
      back={() => { setView('login'); setError('') }} />
  }

  if (view === 'login' || view === 'register') {
    return <AuthView view={view} form={form} upd={upd} submit={submit} error={error} busy={busy}
      toggle={() => { setView(view === 'login' ? 'register' : 'login'); setError('') }}
      forgot={() => { setView('forgot'); setError('') }}
      back={() => { setView('hero'); setError('') }} />
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      {/* ── Navbar ── */}
      <nav style={S.nav}>
        <div className="container" style={S.navInner}>
          <span style={S.logo}>STRYKD</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="pill pill-outline pill-sm" onClick={() => setView('login')}>Log in</button>
            <button className="pill pill-dark pill-sm" onClick={() => setView('register')}>Start free</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="section center" style={{ paddingTop: 'clamp(90px, 14vh, 160px)' }}>
        <div className="container-narrow">
          <motion.h1 className="h-hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            Become the person who<br />actually follows through.
          </motion.h1>
          <motion.p className="lead" style={{ maxWidth: 600, margin: '28px auto 0' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}>
            Strykd turns your goal into a daily plan, then makes quitting impossible: a streak
            you won't want to break, a public page that keeps you honest, and an AI coach that
            adapts as life shifts. Show up daily. Don't break the chain.
          </motion.p>
          <motion.div style={S.heroCtas}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}>
            <button className="pill pill-dark pill-lg" onClick={() => setView('register')}>
              Start free <ArrowRight size={18} />
            </button>
            <button className="pill pill-outline pill-lg" onClick={() => setView('login')}>Log in</button>
          </motion.div>
          <motion.p style={S.heroFine}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.4 }}>
            3 days free · No credit card needed · Cancel anytime
          </motion.p>
        </div>
      </header>

      {/* ── Full-width photo ── */}
      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} style={{ padding: '0 24px' }}>
        <img src={HERO_PHOTO} alt="Someone showing up for their goals"
          style={{ width: '100%', maxWidth: 1140, margin: '0 auto', height: 'clamp(300px, 50vw, 620px)',
            objectFit: 'cover', borderRadius: 24, boxShadow: 'var(--shadow-lift)' }} />
      </motion.div>

      {/* ── How it works ── */}
      <section className="section">
        <div className="container">
          <Reveal><p className="eyebrow center">How it works</p>
            <h2 className="h-xl display center" style={{ margin: '12px 0 64px' }}>Three steps to showing up.</h2></Reveal>
          <motion.div style={S.cols3} variants={staggerContainer()} initial="hidden" whileInView="show" viewport={inView}>
            {STEPS.map(s => (
              <motion.div key={s.n} variants={staggerItem}>
                <div style={S.bigNum}>{s.n}</div>
                <h3 className="h-md" style={{ fontWeight: 700, margin: '8px 0 12px' }}>{s.t}</h3>
                <p className="lead" style={{ fontSize: '1.05rem' }}>{s.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="section bg-gray">
        <div className="container">
          <Reveal><p className="eyebrow center">Real people</p>
            <h2 className="h-xl display center" style={{ margin: '12px 0 16px' }}>People who showed up.</h2>
            <p className="lead center" style={{ maxWidth: 520, margin: '0 auto 64px' }}>
              Not testimonials. Receipts.</p></Reveal>
          <motion.div style={S.reviewGrid} variants={staggerContainer(0.1)} initial="hidden" whileInView="show" viewport={inView}>
            {REVIEWS.map(r => (
              <motion.div key={r.name} className="card card-hover" style={S.reviewCard} variants={staggerItem}>
                <div style={{ display: 'flex', gap: 1, marginBottom: 18 }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="var(--red)" color="var(--red)" />)}
                </div>
                <p style={S.reviewQuote}>"{r.quote}"</p>
                <div style={S.reviewer}>
                  <img src={r.img} alt={r.name} style={S.avatar} loading="lazy" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{r.name}</div>
                    <div style={{ color: 'var(--gray-text)', fontSize: '0.84rem' }}>{r.age} · {r.city}</div>
                    <div style={{ color: 'var(--red)', fontSize: '0.84rem', fontWeight: 600, marginTop: 2 }}>{r.goal}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section">
        <div className="container">
          <Reveal><p className="eyebrow center">What you get</p>
            <h2 className="h-xl display center" style={{ margin: '12px 0 64px' }}>Everything to keep your word.</h2></Reveal>
          <motion.div style={S.featGrid} variants={staggerContainer(0.1)} initial="hidden" whileInView="show" viewport={inView}>
            {FEATURES.map(f => (
              <motion.div key={f.t} className="card" style={S.featCard} variants={staggerItem}>
                <f.Icon size={28} color="var(--black)" strokeWidth={1.75} style={{ marginBottom: 20 }} />
                <h3 className="h-md" style={{ fontWeight: 700, margin: '4px 0 10px' }}>{f.t}</h3>
                <p className="lead" style={{ fontSize: '1.02rem' }}>{f.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Photo band ── */}
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={inView} transition={{ duration: 0.9 }}
        style={{ position: 'relative', height: 'clamp(280px, 40vw, 460px)', overflow: 'hidden' }}>
        <img src={BAND_PHOTO} alt="People building together" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </motion.div>

      {/* ── CTA ── */}
      <section className="section bg-black center">
        <div className="container-narrow">
          <Reveal>
            <h2 className="h-xl display" style={{ marginBottom: 28 }}>Your streak starts today.</h2>
            <p className="lead" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '0 auto 36px' }}>
              The hardest part is day one. Start free, and let the chain do the rest.</p>
            <button className="pill pill-white pill-lg" onClick={() => setView('register')}>
              Start free <ArrowRight size={18} />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '48px 0', borderTop: '1px solid var(--gray-line)' }}>
        <div className="container" style={S.footer}>
          <span style={{ fontWeight: 800, letterSpacing: '0.1em' }}>STRYKD</span>
          <span style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/privacy" style={S.footLink}>Privacy</a>
            <a href="/terms" style={S.footLink}>Terms</a>
            <a href="/contact" style={S.footLink}>Contact</a>
            <span style={{ color: 'var(--gray-light)', fontSize: '0.85rem' }}>
              © {new Date().getFullYear()} Strykd · AI accountability that ships.
            </span>
          </span>
        </div>
      </footer>
    </motion.div>
  )
}

function Reveal({ children }) {
  return (
    <motion.div variants={revealVariants} initial="hidden" whileInView="show" viewport={inView}>
      {children}
    </motion.div>
  )
}

function AuthView({ view, form, upd, submit, error, busy, toggle, forgot, back }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate"
      style={{ minHeight: '100vh', background: 'var(--gray-section)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={S.authCard}>
        <button onClick={back} style={S.authBack}><ArrowLeft size={16} /> Back</button>
        <h1 className="h-lg display" style={{ marginBottom: 8 }}>
          {view === 'login' ? 'Welcome back.' : 'Start your free trial.'}
        </h1>
        <p className="lead" style={{ fontSize: '1rem', marginBottom: 28 }}>
          {view === 'login' ? 'Pick up right where you left off.' : 'No credit card. Cancel anytime. Just show up.'}
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {view === 'register' && (
            <>
              <input className="field" placeholder="Your name" value={form.name} onChange={upd('name')} required />
              <input className="field" placeholder="Choose your slug (e.g. edger)" value={form.slug}
                onChange={upd('slug')} required pattern="[a-z0-9-]+" title="lowercase letters, numbers, hyphens" />
            </>
          )}
          <input className="field" type="email" placeholder="Email" value={form.email} onChange={upd('email')} required />
          <input className="field" type="password" placeholder="Password" value={form.password} onChange={upd('password')} required />
          {view === 'login' && (
            <button type="button" onClick={forgot}
              style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--blue)', fontSize: '0.85rem', fontWeight: 600, marginTop: -4 }}>
              Forgot password?
            </button>
          )}
          {error && <p style={{ color: 'var(--red)', fontSize: '0.88rem' }}>{error}</p>}
          <button type="submit" className="pill pill-dark" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
            {busy ? <Loader2 size={18} className="spin-icon" /> : (view === 'login' ? 'Log in' : 'Create account')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 22, color: 'var(--gray-text)', fontSize: '0.9rem' }}>
          {view === 'login' ? "New here? " : 'Already have an account? '}
          <button onClick={toggle} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600 }}>
            {view === 'login' ? 'Start free' : 'Log in'}
          </button>
        </p>
      </div>
    </motion.div>
  )
}

function ForgotView({ email, setEmail, back }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await api.forgotPassword(email); setSent(true) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate"
      style={{ minHeight: '100vh', background: 'var(--gray-section)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={S.authCard}>
        <button onClick={back} style={S.authBack}><ArrowLeft size={16} /> Back to login</button>
        {sent ? (
          <>
            <CheckCircle2 size={44} color="#34C759" style={{ marginBottom: 12 }} />
            <h1 className="h-lg display" style={{ marginBottom: 8 }}>Check your inbox.</h1>
            <p className="lead" style={{ fontSize: '1rem' }}>
              If that email is registered, a password reset link is on its way. It expires in one hour.
            </p>
          </>
        ) : (
          <>
            <h1 className="h-lg display" style={{ marginBottom: 8 }}>Reset your password.</h1>
            <p className="lead" style={{ fontSize: '1rem', marginBottom: 28 }}>
              Enter your email and we'll send you a link to set a new one.
            </p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              {error && <p style={{ color: 'var(--red)', fontSize: '0.88rem' }}>{error}</p>}
              <button type="submit" className="pill pill-dark" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
                {busy ? <Loader2 size={18} className="spin-icon" /> : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </motion.div>
  )
}

const S = {
  nav: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'saturate(180%) blur(20px)',
    borderBottom: '1px solid var(--gray-line)' },
  navInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 },
  logo: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1.05rem' },
  heroCtas: { display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' },
  heroFine: { marginTop: 22, color: 'var(--gray-light)', fontSize: '0.9rem' },
  cols3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 48 },
  bigNum: { fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 800, color: 'var(--gray-line)', letterSpacing: '-0.03em', lineHeight: 1 },
  reviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 },
  reviewCard: { padding: 32, display: 'flex', flexDirection: 'column' },
  reviewQuote: { fontSize: '1.05rem', lineHeight: 1.55, color: 'var(--ink)', marginBottom: 24, flex: 1 },
  reviewer: { display: 'flex', gap: 14, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 },
  featCard: { padding: 40 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  footLink: { color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' },
  authCard: { width: '100%', maxWidth: 440, padding: 'clamp(28px, 5vw, 44px)' },
  authBack: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--gray-text)',
    fontWeight: 600, fontSize: '0.88rem', marginBottom: 24 },
}
