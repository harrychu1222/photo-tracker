// Added to the app's service worker (see vite.config.js). Shows a push as a phone notification
// and opens the right job when it is tapped.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Site Log', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Site Log', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.id || undefined,
      data: { project: data.project || null, tab: data.tab || null }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { project, tab } = event.notification.data || {}
  const qs = project ? `/?project=${encodeURIComponent(project)}${tab ? `&tab=${encodeURIComponent(tab)}` : ''}` : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list[0]
      if (open) {
        open.postMessage({ type: 'open-project', project, tab })
        return open.focus()
      }
      return self.clients.openWindow(qs)
    })
  )
})
