-- Files on a lead. The product's first use of Supabase Storage.
--
-- A proposal, a signed quote, a spec the customer sent — the things a lead conversation is
-- actually about — had nowhere to live, so they lived in someone's mail client and the lead
-- record was a partial account of its own deal.
--
-- TWO PLACES HOLD STATE, AND THE TABLE IS THE ONE THAT MATTERS
--
-- The bytes go to a private Storage bucket; a row in `lead_files` records what the file is, whose
-- lead it belongs to and who put it there. The row is the record: it is the thing RLS protects by
-- tenant, the thing the lead sheet lists, and the thing a foreign key ties to a lead. The object
-- is addressed by `storage_path`, and the path is derived from ids rather than from the display
-- name, so two files called `הצעה.pdf` cannot collide and a renamed file cannot orphan a row.
--
-- Nothing here is configured by hand in the dashboard. The bucket, its size ceiling and its type
-- allowlist are all created by this migration, so a fresh project or a rebuilt local stack comes
-- up with identical rules — and so the ceiling cannot be a client-side promise the server does not
-- keep. The client checks the same two limits before uploading, purely to fail in Hebrew and
-- instantly rather than after pushing 5MB up a phone connection.

-- ---------------------------------------------------------------------------
-- 1. the bucket
-- ---------------------------------------------------------------------------

-- Private. A signed URL is minted per download, so a leaked link expires; a public bucket would
-- make every customer's proposal world-readable to anybody who learned the path, and paths are
-- guessable from ids that appear in the client.
--
-- 5MB and this allowlist are enforced by Storage itself, before any row exists. Office documents
-- carry macros, so the allowlist is a list rather than a wildcard: the modern XML formats, their
-- legacy binaries, PDF, plain text and CSV, and the three image types a phone camera or a
-- screenshot produces. No zip and no wildcard — an archive smuggles anything past a type check,
-- and this product has no scanner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-files',
  'lead-files',
  false,
  5242880, -- 5 * 1024 * 1024
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. the table
-- ---------------------------------------------------------------------------

create table public.lead_files (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  lead_id      uuid not null,

  -- `<tenant_id>/<lead_id>/<uuid>.<ext>`. Tenant first because the Storage policies below can
  -- only see the object's path, so the first segment has to be the thing membership is checked
  -- against. Unique so a row and an object are one-to-one in both directions.
  storage_path text not null unique,

  -- What the user called it. Display only — never used to build the path.
  name         text not null,
  mime_type    text not null,
  size_bytes   integer not null,

  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),

  -- Composite, so a file cannot be attached to a lead in a different tenant even if a client
  -- forges tenant_id — the same guard pipeline_stages and automations use.
  constraint lead_files_lead_fkey
    foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete cascade,

  constraint lead_files_name_not_blank check (btrim(name) <> ''),
  -- Mirrors the bucket ceiling. Storage rejects an oversized upload first, so this is the
  -- backstop that keeps a row from claiming a size the bucket would never have accepted.
  constraint lead_files_size_ck check (size_bytes > 0 and size_bytes <= 5242880)
);

-- The lead sheet's only query: this lead's files, newest first.
create index lead_files_lead_id_idx on public.lead_files (lead_id, created_at desc);
create index lead_files_tenant_id_idx on public.lead_files (tenant_id);

-- ---------------------------------------------------------------------------
-- 3. RLS — member level, like activities
-- ---------------------------------------------------------------------------

-- Attaching and removing a file is working the lead, not reshaping the business, so it is a
-- member-level act — the same level as logging a call. (Contrast pipeline_stages and automations,
-- which are owner-only because they change what happens to every lead.)
--
-- There is no update policy on purpose: a file's row describes an immutable object. Replacing a
-- file is a delete and a new upload, which keeps `storage_path` honest and the log readable.
alter table public.lead_files enable row level security;

create policy lead_files_select on public.lead_files
  for select to authenticated using ( (select private.is_tenant_member(tenant_id)) );
create policy lead_files_insert on public.lead_files
  for insert to authenticated with check ( (select private.is_tenant_member(tenant_id)) );
create policy lead_files_delete on public.lead_files
  for delete to authenticated using ( (select private.is_tenant_member(tenant_id)) );

-- ---------------------------------------------------------------------------
-- 4. RLS on the objects themselves
-- ---------------------------------------------------------------------------

-- Table RLS protects the *rows*; without these, any signed-in user could read or write any
-- object in the bucket by path and the rows would be a description of a lie. The first path
-- segment is the tenant, checked with the same helper the tables use.
--
-- No update policy, matching the table: an object is written once and deleted, never rewritten.
create policy lead_files_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lead-files'
    and (select private.is_tenant_member(((storage.foldername(name))[1])::uuid))
  );

create policy lead_files_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lead-files'
    and (select private.is_tenant_member(((storage.foldername(name))[1])::uuid))
  );

create policy lead_files_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lead-files'
    and (select private.is_tenant_member(((storage.foldername(name))[1])::uuid))
  );

-- ---------------------------------------------------------------------------
-- 5. who deletes the bytes — and why it is not a trigger
-- ---------------------------------------------------------------------------

-- There is deliberately no `after delete` trigger here cleaning up storage.objects, and this
-- comment exists because writing one is the obvious first instinct. It does not work:
--
--   ERROR: Direct deletion from storage tables is not allowed. Use the Storage API instead.
--   CONTEXT: PL/pgSQL function storage.protect_delete()
--
-- Storage ships its own trigger refusing SQL deletes, so a cleanup trigger does not merely fail
-- to tidy up — it raises, and the raise propagates. Deleting a file would fail, and deleting a
-- lead that has files would fail with it, since the FK cascade below reaches this table. Tested
-- against a real database rather than reasoned about; the first cut of this migration had exactly
-- that trigger and exactly that failure.
--
-- So object cleanup belongs to whoever can call the Storage API, which is the client:
-- `LeadFilesStore.remove()` deletes the row and then removes the object, and the sheet's delete
-- confirmation purges a lead's objects before asking for the lead to be deleted.
--
-- Row-first, object-second, on purpose: if the object removal fails the user still sees the file
-- gone, which is what they asked for, and the cost is an invisible orphan. The other order risks
-- a visible row pointing at bytes that no longer exist, which looks like data loss.
--
-- The residue is real and worth naming: a tab closed mid-delete, or a tenant cascade from account
-- deletion, can leave objects with no row. They are unreachable — every read path goes through
-- `lead_files` — but they are still stored. A scheduled sweep comparing the bucket against this
-- table is the proper answer and is not built; `delete-account` already runs server-side and is
-- where it would go first.
