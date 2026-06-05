// Shared framer-motion variants & transitions

export const easeOut = [0.16, 1, 0.3, 1]

// Page transition: fade + slight upward movement
export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.3, ease: easeOut } },
}

// Section entrance (scroll reveal), use with whileInView
export const revealVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
}

// Stagger container for lists/grids
export const staggerContainer = (stagger = 0.08, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

export const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
}

// Onboarding step slide (direction: 1 forward / -1 back)
export const stepVariants = {
  enter: dir => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easeOut } },
  exit: dir => ({ opacity: 0, x: dir > 0 ? -60 : 60, transition: { duration: 0.3, ease: easeOut } }),
}

// Common viewport config for whileInView
export const inView = { once: true, amount: 0.2 }
