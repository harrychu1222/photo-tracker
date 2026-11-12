import { supabase } from '../supabaseClient'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// 'ok' | 'no-key' (not set up by the app owner yet) | 'unsupported' (e.g. iPhone not added to Home Screen) | 'denied'
export function pushSupport() {
  if (!KEY) return 'no-key'
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'ok'
}

async function registration() {
  return navigator.serviceWorker.ready
}

export async function pushEnabled() {
  if (pushSupport() === 'no-key' || pushSupport() === 'unsupported') return false
  try {
    const sub = await (await registration()).pushManager.getSubscription()
    return !!sub && Notification.permission === 'granted'
  } catch {
    return false
  }
}

export async function enablePush(userId) {
  const support = pushSupport()
  if (support !== 'ok') throw new Error(support === 'denied' ? 'Notifications are blocked for this app. Allow them in your phone settings.' : 'Push is not available here. On iPhone, add Site Log to your Home Screen first.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed.')
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

export async function disablePush() {
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
