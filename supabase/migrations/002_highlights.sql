-- 002_highlights.sql — additive only, does not change 001_init.sql.
-- Adds an optional highlights array used by the work detail page
-- ("主要功能与设计亮点"). Empty by default; the detail section is
-- omitted when a work has no highlights.
alter table works
  add column if not exists highlights text[] not null default '{}';
