/* Retired service worker — kill switch.
 *
 * Earlier builds registered this file at the root scope, which competed with
 * OneSignal's worker and broke web push. Web push is now handled solely by
 * /OneSignalSDKWorker.js. This stub unregisters any lingering old worker so the
 * root scope is freed for OneSignal on the client's next update check.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try { await self.registration.unregister() } catch (e) { /* ignore */ }
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })()
  )
})
