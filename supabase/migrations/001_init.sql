-- AI Portfolio — initial schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, description text, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, title text not null, summary text not null, description text,
  category text not null, tags text[] not null default '{}',
  cover_image_url text, gallery_images text[] not null default '{}',
  demo_url text, repo_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists works_updated_at on public.works;
create trigger works_updated_at before update on public.works for each row execute function public.set_updated_at();
alter table public.categories enable row level security;
alter table public.works enable row level security;
-- Public (anon) may read published works and categories only.
drop policy if exists "public read published works" on public.works;
create policy "public read published works" on public.works for select using (status = 'published');
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);
-- Authenticated users (admin account only — disable public signup in Auth settings) may write.
drop policy if exists "admin write works" on public.works;
create policy "admin write works" on public.works for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Storage bucket: create bucket "portfolio-images" (public) in Dashboard > Storage, then:
-- insert into storage.buckets (id, name, public) values ('portfolio-images','portfolio-images', true) on conflict do nothing;
-- Public read for the bucket:
-- create policy "public read portfolio images" on storage.objects for select using (bucket_id = 'portfolio-images');
-- Authenticated upload/update/delete:
-- create policy "admin write portfolio images" on storage.objects for all using (bucket_id = 'portfolio-images' and auth.role() = 'authenticated') with check (bucket_id = 'portfolio-images' and auth.role() = 'authenticated');
-- Seed categories (optional):
insert into public.categories (name, slug, description, sort_order) values
('网站与 Web 应用','web','AI 生成的网站与 Web 应用',1),
('效率工具','tools','提升日常效率的 AI 工具',2),
('自动化工作流','automation','可复用的自动化流程',3),
('视觉实验','visual','AI 视频、图像与视觉实验',4),
('交互实验','interactive','交互式实验项目',5)
on conflict (slug) do nothing;
