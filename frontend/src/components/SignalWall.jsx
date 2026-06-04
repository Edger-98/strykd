export default function SignalWall({ entries = [] }) {
  if (!entries.length) {
    return <p style={{ color: 'var(--text-muted)' }}>No signal wall entries yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {entries.map((entry, i) => {
        const pct = entry.tasks_total > 0 ? Math.round((entry.tasks_completed / entry.tasks_total) * 100) : 0
        return (
          <div key={i} className="card" style={{ padding: '1.25rem 1.4rem', borderLeft: '2px solid var(--red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>
                {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                }).toUpperCase()}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                {entry.tasks_completed}/{entry.tasks_total}
                <span style={{ color: pct === 100 ? 'var(--blue)' : 'var(--text-muted)', marginLeft: 6 }}>
                  {pct}%
                </span>
              </span>
            </div>
            <p style={{ color: 'var(--text)', lineHeight: 1.6, fontSize: '0.92rem' }}>{entry.ai_summary}</p>
          </div>
        )
      })}
    </div>
  )
}
