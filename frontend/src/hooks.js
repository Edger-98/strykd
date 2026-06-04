import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll. Returns a ref to attach to an element; adds the `in`
 * class once it scrolls into view (pairs with the .reveal CSS).
 */
export function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in')
          obs.unobserve(entry.target)
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return ref
}

/** Small helper to drive a count-up number animation. */
export function useCountUp(target, duration = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!target) { setN(0); return }
    let raf
    const start = performance.now()
    const tick = now => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return n
}
