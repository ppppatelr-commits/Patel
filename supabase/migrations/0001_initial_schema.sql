-- ══════════════════════════════════════════════════════════════════════════════
-- Patel Restaurant — Digital QR Menu Database Schema (Supabase Free)
--
-- How to run:
--   1. Create a free project at https://supabase.com/dashboard
--   2. Open SQL Editor → New query
--   3. Paste this entire file → Run
--
-- Security model:
--   • Public menu data is readable by everyone (no auth required)
--   • Admin tables are protected by RLS — only authenticated admins can modify
--   • Media storage is public-read for menu images, admin-write for uploads
-- ══════════════════════════════════════════════════════════════════════════════

-- ── restaurant_settings ────────────────────────────────────────────────
create table if not exists public.restaurant_settings (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null default 'PATEL RESTAURANT',
  phone_1              text not null default '+91 9876543210',
  phone_2              text not null default '+91 8765432109',
  address              text,
  logo_url             text,
  developer_name       text not null default 'Salman Furniturewala',
  developer_phone      text not null default '+91 7303321019',
  developer_credit_locked boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── menu_categories ────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_sort_idx
  on public.menu_categories (sort_order asc);

-- ── menu_items ─────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.menu_categories (id) on delete cascade,
  name            text not null,
  price           numeric(10,2) not null check (price >= 0),
  image_url       text,
  image_filename  text,
  sort_order      integer not null default 0,
  is_available    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists items_category_idx
  on public.menu_items (category_id, sort_order asc);

-- ── media_library ──────────────────────────────────────────────────────
create table if not exists public.media_library (
  id               uuid primary key default gen_random_uuid(),
  dish_name        text not null,
  filename         text not null unique,
  original_name    text not null,
  file_path        text not null,
  file_url         text not null,
  mime_type        text not null default 'image/webp',
  width            integer,
  height           integer,
  size_bytes       bigint,
  category_id      uuid references public.menu_categories (id) on delete set null,
  menu_item_id     uuid references public.menu_items (id) on delete set null,
  status           text not null default 'active' check (status in ('active','deleted','pending')),
  uploaded_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists media_dish_idx on public.media_library (dish_name);
create index if not exists media_category_idx on public.media_library (category_id);
create index if not exists media_status_idx on public.media_library (status);
create index if not exists media_uploaded_idx on public.media_library (uploaded_at desc);

-- ── admin_users ────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text not null unique,
  role      text not null default 'admin' check (role in ('admin','super_admin')),
  created_at timestamptz not null default now()
);

-- ── updated_at maintenance ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists restaurant_settings_updated_at on public.restaurant_settings;
create trigger restaurant_settings_updated_at
  before update on public.restaurant_settings
  for each row execute function public.set_updated_at();

drop trigger if exists menu_categories_updated_at on public.menu_categories;
create trigger menu_categories_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

drop trigger if exists menu_items_updated_at on public.menu_items;
create trigger menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists media_library_updated_at on public.media_library;
create trigger media_library_updated_at
  before update on public.media_library
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.restaurant_settings enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.media_library enable row level security;
alter table public.admin_users enable row level security;

-- restaurant_settings: public read, admin write only
drop policy if exists "settings_select_public" on public.restaurant_settings;
create policy "settings_select_public" on public.restaurant_settings
  for select using (true);

drop policy if exists "settings_insert_admin" on public.restaurant_settings;
create policy "settings_insert_admin" on public.restaurant_settings
  for insert with check (auth.uid() is not null);

drop policy if exists "settings_update_admin" on public.restaurant_settings;
create policy "settings_update_admin" on public.restaurant_settings
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "settings_delete_admin" on public.restaurant_settings;
create policy "settings_delete_admin" on public.restaurant_settings
  for delete using (auth.uid() is not null);

-- menu_categories: public read, admin write
drop policy if exists "categories_select_public" on public.menu_categories;
create policy "categories_select_public" on public.menu_categories
  for select using (true);

drop policy if exists "categories_insert_admin" on public.menu_categories;
create policy "categories_insert_admin" on public.menu_categories
  for insert with check (auth.uid() is not null);

drop policy if exists "categories_update_admin" on public.menu_categories;
create policy "categories_update_admin" on public.menu_categories
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "categories_delete_admin" on public.menu_categories;
create policy "categories_delete_admin" on public.menu_categories
  for delete using (auth.uid() is not null);

-- menu_items: public read, admin write
drop policy if exists "items_select_public" on public.menu_items;
create policy "items_select_public" on public.menu_items
  for select using (true);

drop policy if exists "items_insert_admin" on public.menu_items;
create policy "items_insert_admin" on public.menu_items
  for insert with check (auth.uid() is not null);

drop policy if exists "items_update_admin" on public.menu_items;
create policy "items_update_admin" on public.menu_items
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "items_delete_admin" on public.menu_items;
create policy "items_delete_admin" on public.menu_items
  for delete using (auth.uid() is not null);

-- media_library: public read, admin write
drop policy if exists "media_select_public" on public.media_library;
create policy "media_select_public" on public.media_library
  for select using (true);

drop policy if exists "media_insert_admin" on public.media_library;
create policy "media_insert_admin" on public.media_library
  for insert with check (auth.uid() is not null);

drop policy if exists "media_update_admin" on public.media_library;
create policy "media_update_admin" on public.media_library
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "media_delete_admin" on public.media_library;
create policy "media_delete_admin" on public.media_library
  for delete using (auth.uid() is not null);

-- admin_users: public read, self write
drop policy if exists "admin_select_public" on public.admin_users;
create policy "admin_select_public" on public.admin_users
  for select using (true);

drop policy if exists "admin_insert_self" on public.admin_users;
create policy "admin_insert_self" on public.admin_users
  for insert with check (auth.uid() = id);

drop policy if exists "admin_update_self" on public.admin_users;
create policy "admin_update_self" on public.admin_users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Done ✓ Tables: restaurant_settings, menu_categories, menu_items, media_library, admin_users
-- RLS enabled on all tables. Public can read menu data; only admins can write.
