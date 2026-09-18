/**
 * Development configuration: the local Supabase stack (docs/ARCHITECTURE.md §11).
 *
 *   supabase start        boots Postgres, Auth, PostgREST, Realtime, Storage in Docker
 *   supabase db reset     replays every migration and supabase/seed.sql (a login + demo leads)
 *   npm start             ng serve against it
 *
 * The URL and key are the CLI's fixed local defaults, identical on every machine; nothing
 * here is a secret. `ng build` replaces this file with environment.prod.ts.
 */
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabasePublishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
};
