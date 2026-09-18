/**
 * Production configuration. `ng build` (default configuration `production`) swaps this in
 * for environment.ts via the fileReplacements in angular.json.
 *
 * There is one Supabase cloud project and it is production (docs/ARCHITECTURE.md §11).
 * The publishable key belongs in source control: it identifies the project and carries
 * no privileges of its own; RLS is the enforcement boundary. The secret key
 * (`sb_secret_…`) lives only in Edge Function secrets.
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://awifckxssybwiheveqqv.supabase.co',
  supabasePublishableKey: 'sb_publishable_R3qn8X1VEA70ZqMoO-nNHw_bNr_Xgjt',
};
