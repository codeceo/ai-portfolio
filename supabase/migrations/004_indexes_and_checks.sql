-- 004_indexes_and_checks.sql — additive only, run AFTER 001, 002, 003.
-- Never edits earlier migrations. All statements are idempotent
-- (IF NOT EXISTS / NOT VALID) so re-running is safe.
--
-- DESIGN CHOICE — categories vs tags (see docs/SECURITY_REVIEW.md):
-- * categories live in their own table (public.categories, admin-managed)
--   and works.category stores the category SLUG. A category is a small,
--   curated, admin-controlled vocabulary: it needs its own list page,
--   sort order and a delete guard, which a free-text column cannot give.
-- * tags are a text[] array column on works. Tags are free-form, many
--   per work, never edited centrally, and only ever used for filtering
--   and search. A join table would add a whole CRUD surface for no
--   benefit at this scale; the GIN index below supports array
--   containment (@>), which is exactly how the repo filters by tag.
-- * NO foreign key works.category -> categories(slug) is added here,
--   deliberately. A live database that went through the pre-004 era
--   could contain orphan category slugs (category deletion used to be
--   unguarded), and a validating FK would make this migration FAIL on
--   such a database. Orphan prevention is enforced in the app layer
--   instead (saveWorkCore rejects unknown categories; deleteCategory-
--   Action blocks deleting a referenced category). Before adding a FK
--   in the future, run the orphan check at the end of this file and
--   reassign or delete the orphans it reports.
--
-- NOT NULL / DEFAULTS REVIEW (001 already provides these; nothing to
-- change, recorded here so the review is explicit):
-- * works.id uuid PK default gen_random_uuid(); slug text NOT NULL UNIQUE.
-- * title, summary, category NOT NULL; description nullable (optional).
-- * tags / gallery_images / highlights text[] NOT NULL DEFAULT '{}'.
-- * status NOT NULL DEFAULT 'draft' + CHECK (status IN
--   ('draft','published','archived')) — already in 001, NOT duplicated
--   here (a second same-name CHECK would conflict on re-run).
-- * featured boolean NOT NULL DEFAULT false; sort_order int NOT NULL
--   DEFAULT 0; created_at / updated_at timestamptz NOT NULL DEFAULT now()
--   (updated_at maintained by the 001 trigger).
-- * 003 fields: source_url / published_at / started_at / seo_title /
--   seo_description / og_image_url nullable (optional); external_links
--   jsonb NOT NULL DEFAULT '[]'.
-- * categories.id uuid PK default gen_random_uuid(); name/slug NOT NULL,
--   slug UNIQUE; sort_order NOT NULL DEFAULT 0.
-- * admins.user_id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE.

-- Indexes matching the real repo queries (all public reads filter
-- status = 'published' first, then category / sort / featured / tags).
create index if not exists idx_works_status
  on public.works (status);
create index if not exists idx_works_status_sort_order
  on public.works (status, sort_order, created_at desc);
create index if not exists idx_works_status_created_at
  on public.works (status, created_at desc);
create index if not exists idx_works_status_category
  on public.works (status, category);
create index if not exists idx_works_category
  on public.works (category);
-- Home "featured" section: published + featured only. Partial index so
-- drafts/archived never enter it, matching listPublished()'s filter.
create index if not exists idx_works_published_featured
  on public.works (sort_order, created_at desc)
  where status = 'published' and featured = true;
-- Tag filtering: array containment (tags @> ARRAY['x']) used by the repo.
create index if not exists idx_works_tags_gin
  on public.works using gin (tags);

-- external_links must stay a JSON array (the app always writes an array;
-- a scalar/object here would break the detail page's .map()).
-- NOT VALID: existing rows are not scanned, so legacy rows can never
-- fail this migration; all future inserts/updates are checked.
alter table public.works
  add constraint works_external_links_is_array
  check (jsonb_typeof(external_links) = 'array') not valid;

comment on table public.works is
  'Portfolio works. Public reads are published-only via RLS; writes require a row in public.admins. Tags are text[] (GIN-indexed); category is a slug referencing public.categories(slug) enforced in the app layer, not by FK — see migration header.';
comment on column public.works.tags is
  'Free-form tags as text[]: filtered with @> containment (GIN index idx_works_tags_gin) and matched as substrings by keyword search. Not a join table by design — see migration header.';

-- ORPHAN CHECK (run manually, read-only, before ever adding a FK):
--   select w.slug, w.category from public.works w
--   left join public.categories c on c.slug = w.category
--   where c.slug is null;
-- Any row it returns must be reassigned to a real category first.
