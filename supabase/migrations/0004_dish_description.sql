-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 0004: Dish Description
--
-- Adds a `description` column to menu_items so admins can store platter contents
-- and other notes per dish.
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this file → Run
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.menu_items
  add column if not exists description text;

-- Done. The app will start persisting descriptions automatically.
