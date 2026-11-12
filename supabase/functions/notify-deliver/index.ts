// Sends the phone alert (and, for the morning summary, the email) for each new notification.
// Called by a Database Webhook on the notifications table (INSERT). See README.md, Stage 6.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const url = Deno.env.get('SUPABASE_URL')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const secret = Deno.env.get('WEBHOOK_SECRET')
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@example.com'
const resendKey = Deno.env.get('RESEND_API_KEY')
const mailFrom = Deno.env.get('MAIL_FROM') // e.g. "Site Log <alerts@yourdomain.com>"

if (vapidPublic && vapidPrivate) webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
const db = createClient(url, service, { auth: { persistSession: false } })

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async (req) => {
  // Only our own webhook may call this.
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Not allowed', { status: 401 })
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const n = payload?.record
  if (payload?.type !== 'INSERT' || !n?.user_id) return new Response('Ignored')

  const results: Record<string, unknown> = {}

  // ---- phone alert ----
  if (n.push && vapidPublic && vapidPrivate) {
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id)
    let sent = 0
    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ id: n.id, title: n.title, body: n.body, project: n.project_id, tab: n.tab }),
          { TTL: 60 * 60 * 12 }
        )
        sent++
      } catch (err: any) {
        // The phone no longer wants these (app removed, permission revoked): forget it.
        if (err?.statusCode === 404 || err?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
    results.push = sent
  }

  // ---- morning summary email, managers only ----
  if (n.kind === 'morning_summary' && resendKey && mailFrom) {
    const { data: profile } = await db.from('profiles').select('email, role').eq('id', n.user_id).maybeSingle()
    const { data: prefs } = await db.from('notification_prefs').select('email_morning').eq('user_id', n.user_id).maybeSingle()
    if (profile?.role === 'admin' && profile.email && prefs?.email_morning !== false) {
      const lines = String(n.body || '').split('\n').filter(Boolean)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: mailFrom,
          to: [profile.email],
          subject: 'Your Site Log morning summary',
          html: `<p>Good morning. Here is what needs a look today:</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
          text: `Good morning. Here is what needs a look today:\n\n${lines.map((l) => `- ${l}`).join('\n')}`
        })
      })
      results.email = res.ok
    }
  }
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } })
})
