-- Local seed, run by `supabase db reset` after the migrations (config.toml [db.seed]).
-- Never run against the cloud project: it creates an auth user with a known password.
--
-- One login:  yaniv@quickdev.co.il / leadflow
-- The signup trigger (handle_new_user) builds the tenant, owner membership, stages and the
-- welcome lead; seed_dev_leads.sql (listed next in config.toml) then fills the board.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue scans these as strings and fails on NULL, so they must be '' not null.
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values (
  '4951b380-eae0-4a1e-919b-fd6fe97479c6',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'yaniv@quickdev.co.il', extensions.crypt('leadflow', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Yaniv"}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(), '4951b380-eae0-4a1e-919b-fd6fe97479c6', '4951b380-eae0-4a1e-919b-fd6fe97479c6',
  'email', '{"sub":"4951b380-eae0-4a1e-919b-fd6fe97479c6","email":"yaniv@quickdev.co.il"}',
  now(), now(), now()
);

