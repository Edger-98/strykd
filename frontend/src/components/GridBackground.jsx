/**
 * Vercel-style subtle geometric grid with "+" markers at key intersections.
 * Sits behind page content (z-index 0). Pages set their own z-index:1 wrapper.
 */
export default function GridBackground({ wash = 'red', markers = true }) {
  return (
    <>
      <div className="grid-bg" />
      {wash === 'red' && <div className="wash-red" />}
      {wash === 'rb' && <div className="wash-rb" />}
      {markers && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          {MARKERS.map(([top, left], i) => (
            <Plus key={i} top={top} left={left} />
          ))}
        </div>
      )}
    </>
  )
}

const MARKERS = [
  ['18%', '12%'], ['18%', '88%'],
  ['50%', '50%'],
  ['78%', '20%'], ['72%', '80%'],
]

function Plus({ top, left }) {
  return (
    <span style={{
      position: 'absolute', top, left, transform: 'translate(-50%, -50%)',
      width: 14, height: 14, color: 'var(--line-bright)',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  )
}
