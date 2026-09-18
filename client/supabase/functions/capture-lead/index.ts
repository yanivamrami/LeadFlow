// Inbound lead capture. The one HTTP surface LeadFlow exposes: a caller with a tenant's capture
// token posts a lead and it lands on that tenant's board. First caller is the Netlush WhatsApp
// bot; the public web form (SCREENS 8.2) will use the same endpoint.
//
// This file is deliberately thin. Authentication, rate limiting, validation, idempotency and
// both inserts live in the `capture_lead` RPC (migration 20260918100100), which only the
// secret-key client can call. Here we only: read the bearer token, parse JSON, call the RPC,
// map its one-word errors to HTTP statuses. Contract: documents/PLAN-capture-lead.md §6.
//
// Deploy:  supabase functions deploy capture-lead --no-verify-jwt
//          (--no-verify-jwt because the bearer is our capture token, not a Supabase JWT.)
// Secrets: none to set. SUPABASE_SECRET_KEYS.default is injected, as in delete-account.
//
// Privacy: request bodies are never logged. Name and phone are personal data.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const started = Date.now();
  const url = Deno.env.get('SUPABASE_URL');
  const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'];
  if (!url || !secret) {
    console.error('capture-lead: SUPABASE_URL or SUPABASE_SECRET_KEYS.default is not set');
    return json({ error: 'internal' }, 500);
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'unauthorized' }, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'validation', field: 'body' }, 400);
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return json({ error: 'validation', field: 'body' }, 400);
  }

  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('capture_lead', { p_token: token, p_payload: payload });

  const ref = String((payload as Record<string, unknown>).external_ref ?? '');
  const ms = Date.now() - started;

  if (error) {
    const msg = error.message ?? '';
    if (msg === 'unauthorized') {
      console.log(`capture-lead 401 ref=${ref} ${ms}ms`);
      return json({ error: 'unauthorized' }, 401);
    }
    if (msg === 'rate_limited') {
      console.log(`capture-lead 429 ref=${ref} ${ms}ms`);
      return json({ error: 'rate_limited' }, 429);
    }
    if (msg.startsWith('validation:')) {
      const field = msg.slice('validation:'.length);
      console.log(`capture-lead 400 field=${field} ref=${ref} ${ms}ms`);
      return json({ error: 'validation', field }, 400);
    }
    console.error(`capture-lead 500 ref=${ref} ${ms}ms`, msg);
    return json({ error: 'internal' }, 500);
  }

  const result = data as { lead_id: string; created: boolean; tenant_id: string };
  const status = result.created ? 201 : 200;
  console.log(`capture-lead ${status} tenant=${result.tenant_id} ref=${ref} ${ms}ms`);
  return json({ lead_id: result.lead_id, created: result.created }, status);
});
