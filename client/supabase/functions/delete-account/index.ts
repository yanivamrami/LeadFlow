// Deletes the calling user's own account. The one operation in this product that cannot
// happen in the browser: removing a row from `auth.users` needs the secret key, and the
// secret key never ships to a client.
//
// Everything else follows from that single delete:
//   auth.users → profiles (on delete cascade)
//              → memberships (on delete cascade)
//              → memberships_delete_orphan_tenant trigger drops a tenant left with no
//                members, taking its leads, activities, reminders and qualification
//                answers with it (supabase/migrations, §7d).
//
// So a sole-owner tenant is fully removed, and a tenant someone else still belongs to
// survives without this user — which is the correct outcome for both, per
// docs/ARCHITECTURE.md §9.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: none to set. Supabase injects SUPABASE_SECRET_KEYS (a JSON dictionary of the
//          project's secret keys, named) into every function; we read `default`. The
//          legacy service_role JWT is deprecated and must not be introduced here, per
//          PRODUCT.md.

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

  const url = Deno.env.get('SUPABASE_URL');
  const secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'];
  if (!url || !secret) {
    console.error('delete-account: SUPABASE_URL or SUPABASE_SECRET_KEYS.default is not set');
    return json({ error: 'not_configured' }, 500);
  }

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthenticated' }, 401);

  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The identity comes from the verified token, never from the request body. A user id
  // in the payload would let any signed-in caller delete anyone.
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return json({ error: 'unauthenticated' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete-account: delete failed', deleteError.message);
    return json({ error: 'delete_failed' }, 500);
  }

  return json({ deleted: true }, 200);
});
