/* OneSignal web-push integration.
 *
 * The app id is fetched at runtime from the backend (`/public-config`) so it
 * never has to be baked into the static build. OneSignal owns the root-scope
 * service worker (`/OneSignalSDKWorker.js`) using its default paths — which is
 * what the OneSignal dashboard is configured for; using a custom path/scope
 * makes it report "App not configured for web push". The logged-in user is
 * identified to OneSignal by their Strykd user id (external id), which is how
 * the backend targets pushes.
 */
import OneSignal from 'react-onesignal'
import { api } from './api'

// Must match the OneSignal app configured for https://strykdapp.com.
const ONESIGNAL_APP_ID = '0ec653e3-8df0-4a38-ad41-d04f82294fa9'

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
      // Prefer the backend-provided id, but fall back to the known constant so
      // init never fails just because /public-config is briefly unreachable.
      const cfg = await api.getPublicConfig().catch(() => ({}))
      const appId = cfg?.onesignal_app_id || ONESIGNAL_APP_ID
      if (!appId) return false
      // Default (root) service worker — OneSignalSDKWorker.js at /, scope /.
      await OneSignal.init({
        appId,
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
