/* POST /.netlify/functions/send   (admin only — used by the ingestion job)
   Body: { title, body, url, tag }
   Header: x-admin-token: <ADMIN_TOKEN env>
   Sends a Web Push to every stored subscription; prunes dead ones. */
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const token = req.headers.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys not configured' }, 500);
  }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@getdiscounted.my',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const store = getStore('push-subs');
  const { blobs } = await store.list();
  let sent = 0, removed = 0, failed = 0;

  for (const b of blobs) {
    const rec = await store.get(b.key, { type: 'json' });
    if (!rec || !rec.subscription) continue;
    try {
      await webpush.sendNotification(rec.subscription, JSON.stringify(payload));
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await store.delete(b.key); removed++; }
      else failed++;
    }
  }
  return json({ sent, removed, failed, total: blobs.length }, 200);
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
