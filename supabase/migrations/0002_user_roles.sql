-- ══════════════════════════════════════════════════════════════════════════════
-- Patel Restaurant — User Roles
--
-- Cloud user management stores the role in Supabase Auth metadata:
--   auth.users.app_metadata.role  = 'admin' | 'user'
--   auth.users.user_metadata.name = display name
--
-- This migration only relaxes the admin_users table so the 'user' role is
-- accepted if you also mirror accounts there. Run it after 0001_initial_schema.sql.
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.admin_users drop constraint if exists admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check check (role in ('admin', 'super_admin', 'user'));

-- Done.
