# Patel RESTAURANT — DIGITAL QR MENU
## Handover & User Guide

> **Confidential.** Contains admin login credentials. Share only with authorized staff.

---

## 1. Live URLs

| Purpose | URL |
|---|---|
| **Customer Menu (Public)** | https://Patel-restaurant-one.vercel.app |
| **Menu Page** | https://Patel-restaurant-one.vercel.app/menu |
| **Admin Login** | https://Patel-restaurant-one.vercel.app/login |
| **Admin Dashboard** | https://Patel-restaurant-one.vercel.app/admin |
| **Media Library** | https://Patel-restaurant-one.vercel.app/admin/media |
| **Menu Items** | https://Patel-restaurant-one.vercel.app/admin/items |
| **Categories** | https://Patel-restaurant-one.vercel.app/admin/categories |
| **Settings** | https://Patel-restaurant-one.vercel.app/admin/settings |
| **QR Stands** | https://Patel-restaurant-one.vercel.app/admin/qrcode |
| **Users** | https://Patel-restaurant-one.vercel.app/admin/users |
| **Backup** | https://Patel-restaurant-one.vercel.app/admin/backup |

---

## 2. Admin Login Credentials (Default)

| Field | Value |
|---|---|
| **Email** | `admin@Patelrestaurant.com` |
| **Password** | `admin123` |

> ⚠️ Change this password after first login via **My Account** in the admin panel. Do not share with unauthorized people.

---

## 3. What this system does

- A **digital QR menu** for Patel RESTAURANT (33 categories, 304 dishes).
- Customers scan a QR code → open the menu on their phone → browse dishes with photos, prices, and categories.
- **No ordering, no cart, no payment** — view-only menu.
- Admin panel to manage categories, dishes, images, settings, users, QR stands, and backups.
- All changes reflect **live** on the customer menu instantly.

---

## 4. How to use the Admin Panel

### Login
1. Open https://Patel-restaurant-one.vercel.app/login
2. Enter the email and password above.
3. Click **Login**. (Use the eye icon to show/hide password.)

### Dashboard
- Shows counts: categories, dishes, images, missing images.
- Click any stat card to jump to that section.

### Menu Categories (`/admin/categories`)
- **Add**: click "+ Add Category", enter name, save.
- **Edit**: click a category → change name/image → Save.
- **Reorder**: drag the ☰ handle to reorder. Click "Save Order" to persist.
- **Delete**: click Delete (removes category + its dishes).
- **Upload category image**: use the image upload in the edit modal.

### Menu Items / Dishes (`/admin/items`)
- **Filter** by category or search by dish name.
- **Edit a dish**: click "Edit" → change name, price, category, position, image → "Save Changes".
- **Add a dish**: click "+ Add New Item" → fill name, category, price, image → Add.
- **Delete**: click Delete.
- **Reorder**: drag within a category, then "Save Order".
- **Upload image**: in the edit modal, pick a file → "Upload" → "Save Changes".

### Media Library (`/admin/media`)
- View all dish images (baked-in + uploaded).
- **Search** by dish name or filename.
- **Filter** by category / status, sort by newest/oldest.
- **Replace image**: click Replace → pick a new file → the dish image updates automatically everywhere.
- **Delete**: click Delete (image removed; dish shows placeholder).
- **Bulk delete**: select multiple → "Delete Selected".
- **Upload new image**: "Upload" button at top.

### Restaurant Settings (`/admin/settings`)
- Change restaurant name, phone 1, phone 2, logo.
- Upload a new logo (replaces `/logo.png`).
- Developer credit is **locked** (not editable) — always "Salman Furniturewala / +91 7303321019".

### User Management (`/admin/users`) — Admin only
- Create new users (admin or limited user).
- Edit name, email, role, password.
- Delete users (cannot delete the last admin).

### QR Code & Stands (`/admin/qrcode`)
- Preview the table stand card.
- Enter a Table Number for custom table cards.
- **Download PNG** — full high-res stand design.
- **Download PDF** — print-ready A4.
- **Print** — prints only the stand card (no dashboard).
- Place the printed card in acrylic table stands.

### Backup & Restore (`/admin/backup`)
- **Create Backup**: downloads a ZIP with all menu data + images.
- **Restore**: upload a backup ZIP to restore everything.

### My Account (`/admin/account`)
- Change your own name, email, password.

---

## 5. Customer flow
1. Customer scans the QR code on the table.
2. The digital menu opens in their browser.
3. They browse categories and dishes, see photos and prices.
4. They can tap a phone number to call the restaurant.
5. No ordering or payment — view only.

---

## 6. Important notes

- **Phone numbers**: +91 8879396241 and 022-23478066 (shown on the menu and footer).
- **Images**: 304 dish images are built into the site. You can replace any via Media Library or Dish Management — changes reflect live.
- **Cache**: If a change doesn't show, click **🧹 Clear Cache** in the admin top bar / sidebar.
- **Supabase**: The database and image storage are on Supabase (free tier). If images fail to upload, ensure the `menu-images` storage bucket exists (it's auto-created on first upload).
- **Do not delete** the last admin user.
- **Developer credit** is locked and cannot be edited.

---

## 7. Handover checklist
- [ ] Change the default admin password.
- [ ] Add real staff users via User Management.
- [ ] Test scanning the QR code on a phone.
- [ ] Print table stands and place on tables.
- [ ] Verify the menu shows correct prices and images.
- [ ] Create a backup before making bulk changes.

---

---

## 8. Enable dish descriptions (one-time setup)

To let admins save custom descriptions per dish on the live (Vercel) site, run this once in the Supabase dashboard:

1. Open https://supabase.com/dashboard ? your project ? **SQL Editor** ? **New query**.
2. Paste and run:

\\\sql
alter table public.menu_items add column if not exists description text;
\\\

3. Done. The admin "Edit Menu Item" modal already has a **Description** field; after this, edits persist.

> Without this step, descriptions for the 4 platter dishes still show (built-in), but custom descriptions added by admins won't persist on Vercel. Local dev persists them automatically.

---

*System developed by Salman Furniturewala � +91 7303321019 � Last updated: November 2026*
*Last updated: November 2026*

