/**
 * Development configuration — the same single Supabase cloud project as production
 * (docs/ARCHITECTURE.md §11: no local Docker stack, `ng serve` talks to live data).
 *
 * The publishable key belongs in source control. It identifies the project and
 * carries no privileges of its own; RLS is the enforcement boundary (§212).
 * The secret key (`sb_secret_…`) must never appear in this file or any other
 * file under client/ — it lives only in Edge Function secrets.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://awifckxssybwiheveqqv.supabase.co',
  supabasePublishableKey: 'sb_publishable_R3qn8X1VEA70ZqMoO-nNHw_bNr_Xgjt',
};
