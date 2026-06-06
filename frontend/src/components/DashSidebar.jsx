import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Map, Radio, Settings, ExternalLink, LogOut, X, Plus } from 'lucide-react'
import Avatar from './Avatar'

/**
 * Shared dark dashboard sidebar used by the Dashboard and Journey pages.
 * `active` is one of: 'today' | 'journey' | 'signal'.
 */
export default function DashSidebar({ user, active, navOpen, setNavOpen, onLogout, onAddGoal }) {
  const nav = useNavigate()
  const go = path => { setNavOpen(false); nav(path) }

  return (
    <>
      <aside className={`dash-sidebar${navOpen ? ' open' : ''}`} style={S.sidebar}>
        <div style={S.sideTop}>
          <span style={S.logo}>STRYKD</span>
          <button style={S.icon} onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <button style={{ ...S.profile, cursor: 'pointer', textAlign: 'left' }} onClick={() => go('/dashboard/settings')}>
          <Avatar src={user.avatar_url} name={user.name} size={40} />
          <div style={{ overflow: 'hidden' }}>
            <div style={S.profileName}>{user.name}</div>
            <div style={{ color: 'var(--d-text-muted)', fontSize: '0.78rem' }}>@{user.slug}</div>
          </div>
        </button>

        <nav style={S.navList}>
          <Item active={active === 'today'} Icon={LayoutGrid} label="Today" onClick={() => go('/dashboard')} />
          <Item active={active === 'journey'} Icon={Map} label="Journey" onClick={() => go('/dashboard/journey')} />
          <Item active={active === 'signal'} Icon={Radio} label="Signal Wall" onClick={() => go('/dashboard?tab=signal')} />
          <Item active={active === 'settings'} Icon={Settings} label="Settings" onClick={() => go('/dashboard/settings')} />
          {user.page_public !== false && (
            <a href={`/${user.slug}`} target="_blank" rel="noreferrer" style={S.navItem}>
              <ExternalLink size={18} /> <span>Public page</span>
            </a>
          )}
        </nav>

        {onAddGoal && (
          <button onClick={() => { setNavOpen(false); onAddGoal() }} style={S.addGoal}>
            <Plus size={17} /> Add another goal
          </button>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button style={S.logout} onClick={onLogout}><LogOut size={16} /> Log out</button>
        </div>
      </aside>

      {navOpen && <div style={S.overlay} onClick={() => setNavOpen(false)} />}
    </>
  )
}

function Item({ active, Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }}>
      <Icon size={18} color={active ? 'var(--red)' : 'var(--d-text-dim)'} /> <span>{label}</span>
    </button>
  )
}

export const SIDEBAR_W = 260
const S = {
  sidebar: {
    width: SIDEBAR_W, flexShrink: 0, background: 'var(--d-bg)', borderRight: '1px solid var(--d-line)',
    display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'fixed', top: 0, bottom: 0, left: 0,
    transition: 'transform 0.25s var(--ease)', zIndex: 30,
  },
  sideTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', marginBottom: 24 },
  logo: { fontWeight: 800, letterSpacing: '0.12em', fontSize: '1rem' },
  profile: { display: 'flex', gap: 12, alignItems: 'center', padding: 12, width: '100%', background: 'var(--d-card)', border: '1px solid var(--d-line)', borderRadius: 14, marginBottom: 20, color: 'var(--d-text)' },
  profileName: { fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  navList: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', background: 'transparent', border: 'none',
    borderRadius: 12, color: 'var(--d-text-dim)', fontSize: '0.92rem', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s var(--ease)' },
  navItemActive: { background: 'var(--d-card)', color: 'var(--d-text)' },
  addGoal: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: '11px 12px',
    width: '100%', background: 'transparent', border: '1px dashed var(--d-line)', borderRadius: 12,
    color: 'var(--d-text-dim)', fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s var(--ease)' },
  logout: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', width: '100%', background: 'transparent',
    border: 'none', color: 'var(--d-text-muted)', fontSize: '0.88rem', fontWeight: 500, borderRadius: 12 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20 },
  icon: { background: 'transparent', border: 'none', color: 'var(--d-text-dim)', padding: 4, display: 'grid', placeItems: 'center' },
}
