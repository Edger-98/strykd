/* Strykd service worker.
 *
 * Powers the PWA shell and handles push notification display. Web push for
 * Strykd is delivered through OneSignal, which registers its own worker
 * (public/push/OneSignalSDKWorker.js) under a narrower scope — this worker
 * owns the root scope and provides a standards-based push handler as well, so
 * notifications still display if a raw Web Push payload is ever delivered here.
 */
const VERSION = 'strykd-v1'

self.addEventListener('install', () => {
  // Activate the new worker immediately on update.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Display an incoming push. Payload may be JSON ({title, body, url, icon}) or text.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Strykd'
  const options = {
    body: data.body || data.alert || data.message || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || data.launchURL || '/dashboard' },
    tag: data.tag || 'strykd',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing tab if open, otherwise open the target URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
