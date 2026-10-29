-- 003_admin_and_fields.sql — additive only, run AFTER 001_init.sql and 002_highlights.sql.
-- 1) New optional work fields. Existing rows survive (nullable / defaults).
alter table public.works
  add column if not exists source_url text,
  add column if not exists external_links jsonb not null default '[]'::jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists started_at date,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_image_url text;

-- 2) Admin allowlist. Only users listed here may write, even if authenticated.
--    Insert the admin AFTER inviting them in Supabase Auth (see README):
--      insert into public.admins (user_id, email)
--      values ('<uuid from Authentication > Users>', 'admin@example.com');
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- An admin can read their own allowlist row (this is what the server
-- isAdmin() check queries). No self-service insert/update/delete.
drop policy if exists "admins self read" on public.admins;
create policy "admins self read" on public.admins
  for select using (auth.uid() = user_id);

-- 3) Replace the 001 "any authenticated user may write" policies with
--    allowlist policies. Public read-published policies are untouched.
drop policy if exists "admin write works" on public.works;
create policy "admin allowlist write works" on public.works
  for all
  using (auth.role() = 'authenticated' and exists (select 1 from public.admins where user_id = auth.uid()))
  with check (auth.role() = 'authenticated' and exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "admin write categories" on public.categories;
create policy "admin allowlist write categories" on public.categories
  for all
  using (auth.role() = 'authenticated' and exists (select 1 from public.admins where user_id = auth.uid()))
  with check (auth.role() = 'authenticated' and exists (select 1 from public.admins where user_id = auth.uid()));

-- 4) Storage: tighten the 001 "authenticated write" note into an
--    allowlist policy (run only after the portfolio-images bucket exists).
--    Public read for the bucket is unchanged.
-- create policy "admin allowlist write portfolio images" on storage.objects
--   for all using (bucket_id = 'portfolio-images' and auth.role() = 'authenticated'
--     and exists (select 1 from public.admins where user_id = auth.uid()))
--   with check (bucket_id = 'portfolio-images' and auth.role() = 'authenticated'
--     and exists (select 1 from public.admins where user_id = auth.uid()));
