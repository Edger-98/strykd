import { useEffect } from 'react'

const PALETTES = {
  'dark-ember': {
    '--bg': '#0D0805', '--bg-card': '#1A100A', '--bg-hover': '#261508',
    '--fg': '#F5F0EB', '--fg-dim': '#A89080', '--fg-muted': '#6B5040',
    '--accent': '#E85D04', '--accent-dim': '#C04B03', '--accent-glow': 'rgba(232,93,4,0.25)',
    '--border': '#3D1F10',
  },
  'arctic-focus': {
    '--bg': '#FFFFFF', '--bg-card': '#F0F6FC', '--bg-hover': '#E8F0F8',
    '--fg': '#0F172A', '--fg-dim': '#475569', '--fg-muted': '#94A3B8',
    '--accent': '#0EA5E9', '--accent-dim': '#0284C7', '--accent-glow': 'rgba(14,165,233,0.2)',
    '--border': '#CBD5E1',
  },
  'soft-earth': {
    '--bg': '#F5F0E8', '--bg-card': '#EDE7DC', '--bg-hover': '#E4DDD0',
    '--fg': '#3D2B1F', '--fg-dim': '#7A5C45', '--fg-muted': '#B09070',
    '--accent': '#C2714F', '--accent-dim': '#A05A3A', '--accent-glow': 'rgba(194,113,79,0.2)',
    '--border': '#D4C5B0',
  },
}

const TYPOGRAPHY = {
  'bold-condensed': {
    '--font-display': '"Arial Black", Impact, condensed, sans-serif',
    '--font-body': 'system-ui, -apple-system, sans-serif',
    '--fw-display': '900', '--ls-display': '0.04em', '--lh-display': '1.05',
  },
  'editorial': {
    '--font-display': 'Georgia, "Times New Roman", serif',
    '--font-body': 'Georgia, serif',
    '--fw-display': '700', '--ls-display': '0.01em', '--lh-display': '1.2',
  },
  'minimal': {
    '--font-display': 'system-ui, -apple-system, "Segoe UI", sans-serif',
    '--font-body': 'system-ui, -apple-system, sans-serif',
    '--fw-display': '600', '--ls-display': '-0.01em', '--lh-display': '1.15',
  },
}

export default function ThemeWrapper({ theme, children }) {
  useEffect(() => {
    if (!theme) return
    const root = document.documentElement
    const vars = {
      ...(PALETTES[theme.color_palette] || PALETTES['arctic-focus']),
      ...(TYPOGRAPHY[theme.typography_variant] || TYPOGRAPHY['minimal']),
    }
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    return () => Object.keys(vars).forEach(k => root.style.removeProperty(k))
  }, [theme])

  return children
}
