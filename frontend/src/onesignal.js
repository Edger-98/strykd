/* OneSignal web-push integration.
 *
 * The app id is fetched at runtime from the backend (`/public-config`) so it
 * never has to be baked into the static build. OneSignal registers its own
 * service worker under the /push/onesignal/ scope, leaving the root scope to
 * Strykd's own sw.js. The logged-in user is identified to OneSignal by their
 * Strykd user id (external id), which is how the backend targets pushes.
 */
import OneSignal from 'react-onesignal'
import { api } from './api'

let initPromise = null

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent || '')

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true)

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window

// Browser permission state: 'default' | 'granted' | 'denied'
export const pushPermission = () =>
  pushSupported() ? Notification.permission : 'denied'

// Init once (idempotent). Returns true if OneSignal is configured and ready.
export function ensureOneSignal(userId) {
  if (!initPromise) {
    initPromise = (async () => {
      const cfg = await api.getPublicConfig().catch(() => ({}))
      if (!cfg?.onesignal_app_id) return false
      await OneSignal.init({
        appId: cfg.onesignal_app_id,
        serviceWorkerParam: { scope: '/push/onesignal/' },
        serviceWorkerPath: 'push/OneSignalSDKWorker.js',
        allowLocalhostAsSecureOrigin: true,
      })
      return true
    })()
  }
  // Tie the OneSignal subscription to the Strykd user whenever we know it.
  if (userId) {
    initPromise.then(ok => { if (ok) OneSignal.login(String(userId)).catch(() => {}) })
  }
  return initPromise
}

// Prompt the browser and opt the user in. Returns true if permission granted.
export async function enablePush(userId) {
  const ready = await ensureOneSignal(userId)
  if (!ready) throw new Error('Push notifications are not available yet.')
  await OneSignal.Notifications.requestPermission()
  try { await OneSignal.User.PushSubscription.optIn() } catch (e) { /* ignore */ }
  return OneSignal.Notifications.permission === true || pushPermission() === 'granted'
}

export async function disablePush() {
  try { await OneSignal.User.PushSubscription.optOut() } catch (e) { /* ignore */ }
}
