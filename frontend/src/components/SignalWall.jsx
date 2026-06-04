export default function SignalWall({ entries = [] }) {
  if (!entries.length) {
    return <p style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>No signal wall entries yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {entries.map((entry, i) => {
        const pct = entry.tasks_total > 0
          ? Math.round((entry.tasks_completed / entry.tasks_total) * 100)
          : 0

        return (
          <div key={i} style={{
            padding: '1rem 1.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '0 8px 8px 0',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>
                {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                }).toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-dim)' }}>
                {entry.tasks_completed}/{entry.tasks_total} tasks
                {' · '}
                <span style={{ color: pct === 100 ? 'var(--accent)' : 'var(--fg-dim)' }}>
                  {pct}%
                </span>
              </span>
            </div>
            <p style={{ color: 'var(--fg)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              {entry.ai_summary}
            </p>
          </div>
        )
      })}
    </div>
  )
}
