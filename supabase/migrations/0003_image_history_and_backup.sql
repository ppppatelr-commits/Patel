-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0003: Image History + Backup System
-- ══════════════════════════════════════════════════════════════════════════════

-- ── image_history ──────────────────────────────────────────────────────────
-- Tracks every image replacement per menu item so admins can restore them.
create table if not exists public.image_history (
  id              uuid primary key default gen_random_uuid(),
  menu_item_id    uuid not null references public.menu_items (id) on delete cascade,
  replaced_at     timestamptz not null default now(),
  previous_url    text not null,
  previous_filename text,
  storage_path    text,          -- Supabase storage path if stored in bucket
  is_current      boolean not null default false,  -- marks the active image
  replaced_by     text,          -- admin email who made the change
  notes           text
);

create index if not exists image_history_item_idx
  on public.image_history (menu_item_id, replaced_at desc);

-- ── backups ────────────────────────────────────────────────────────────────
-- Metadata for each backup (actual file stored in Supabase storage or local)
create table if not exists public.backups (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      text,
  label           text,
  filename        text not null,
  storage_path    text,         -- path in backups bucket
  download_url    text,         -- signed/public URL
  size_bytes      bigint,
  category_count  integer,
  item_count      integer,
  image_count     integer,
  status          text not null default 'complete'
                  check (status in ('complete','partial','failed')),
  manifest        jsonb          -- summary JSON embedded
);

create index if not exists backups_created_idx on public.backups (created_at desc);

-- ── RLS for new tables ─────────────────────────────────────────────────────
alter table public.image_history enable row level security;
alter table public.backups enable row level security;

-- image_history: public read (so edit modal can load history), admin write
drop policy if exists "image_history_select_public" on public.image_history;
create policy "image_history_select_public" on public.image_history
  for select using (true);

drop policy if exists "image_history_insert_admin" on public.image_history;
create policy "image_history_insert_admin" on public.image_history
  for insert with check (auth.uid() is not null);

drop policy if exists "image_history_update_admin" on public.image_history;
create policy "image_history_update_admin" on public.image_history
  for update using (auth.uid() is not null);

drop policy if exists "image_history_delete_admin" on public.image_history;
create policy "image_history_delete_admin" on public.image_history
  for delete using (auth.uid() is not null);

-- backups: admin only
drop policy if exists "backups_select_admin" on public.backups;
create policy "backups_select_admin" on public.backups
  for select using (auth.uid() is not null);

drop policy if exists "backups_insert_admin" on public.backups;
create policy "backups_insert_admin" on public.backups
  for insert with check (auth.uid() is not null);

drop policy if exists "backups_update_admin" on public.backups;
create policy "backups_update_admin" on public.backups
  for update using (auth.uid() is not null);

drop policy if exists "backups_delete_admin" on public.backups;
create policy "backups_delete_admin" on public.backups
  for delete using (auth.uid() is not null);

-- Also add image_url column to menu_categories (needed for category images)
alter table public.menu_categories
  add column if not exists image_url text;

-- Done ✓  Tables: image_history, backups   |   Columns: menu_categories.image_url

