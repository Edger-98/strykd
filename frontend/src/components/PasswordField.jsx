import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Password input with a show/hide eye toggle. Drop-in replacement for a plain
 * <input type="password">; pass the same className (e.g. "field" or "d-field").
 */
export default function PasswordField({ className = 'field', style, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={className}
        style={{ ...style, width: '100%', paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: 'currentColor', opacity: 0.5, display: 'grid', placeItems: 'center',
        }}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
