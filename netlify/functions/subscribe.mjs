/* POST /.netlify/functions/subscribe
   Stores a Web Push subscription (keyed by a hash of its endpoint) in Netlify Blobs. */
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  let sub;
  try { sub = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!sub || !sub.endpoint) return json({ error: 'missing subscription' }, 400);

  // Optional user preferences the client can send along.
  const prefs = sub.prefs || {};
  const record = { subscription: { endpoint: sub.endpoint, keys: sub.keys }, prefs, createdAt: Date.now() };

  const store = getStore('push-subs');
  const key = crypto.createHash('sha256').update(sub.endpoint).digest('hex');
  await store.setJSON(key, record);
  return json({ ok: true }, 200);
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors }
  });
}
