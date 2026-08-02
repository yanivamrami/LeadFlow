/**
 * Production configuration. This is the default build target; `ng serve` swaps in
 * environment.development.ts via the fileReplacements in angular.json.
 *
 * The production Supabase project does not exist yet — docs/ARCHITECTURE.md §11
 * has it as "Production (when we get there)". These stay empty deliberately:
 * SupabaseService refuses to start on an unconfigured URL or key, so a production
 * build fails loudly instead of quietly pointing real users at the dev database.
 */
export const environment = {
  production: true,
  supabaseUrl: '',
  supabasePublishableKey: '',
};
