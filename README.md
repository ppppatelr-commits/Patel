# Patel Restaurant — Premium Digital QR Menu

A complete, professional, mobile-first digital restaurant menu website for Patel RESTAURANT, built with Next.js 16, TypeScript, Tailwind CSS, and Supabase.

## 📋 Project Identity

- **Restaurant**: Patel RESTAURANT
- **Developer**: Salman Furniturewala
- **Developer Contact**: +91 7303321019
- **Website Type**: Premium Digital QR Menu (Browse only — no cart, no checkout, no payments)
- **Theme**: Luxury Dark / Gold
- **Food Photography**: AI Generated (unique image per menu item)
- **Media Management**: WordPress-style Media Library
- **Deployment**: Vercel

## 📁 Project Structure

```
Patel-restaurant/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── tailwind.config.ts
├── .env.example
├── .env.local                          # Create this from .env.example
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql     # Database schema
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Dark theme CSS
│   │   ├── page.tsx                    # Public menu (no auth required)
│   │   ├── login/
│   │   │   └── page.tsx                # Admin login
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Admin dashboard overview
│   │   ├── admin/
│   │   │   ├── layout.tsx              # Admin layout (auth-protected)
│   │   │   ├── page.tsx                # Redirect to categories
│   │   │   ├── categories/
│   │   │   │   └── page.tsx            # Category management
│   │   │   ├── items/
│   │   │   │   └── page.tsx            # Menu item management
│   │   │   ├── media/
│   │   │   │   └── page.tsx            # WordPress-style Media Library
│   │   │   └── settings/
│   │   │       └── page.tsx            # Restaurant settings
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── me/route.ts
│   │       ├── categories/route.ts
│   │       ├── items/route.ts
│   │       ├── media/route.ts
│   │       └── import/route.ts         # Import menu data from PDF
│   │       └── placeholder/[dish]/route.ts  # SVG placeholder for missing images
│   ├── components/
│   │   ├── footer.tsx                  # Footer with phone links & developer credit
│   │   ├── category-pill.tsx           # Category navigation pill
│   │   └── menu-card.tsx               # Individual menu item card
│   ├── lib/
│   │   ├── supabase.ts                 # Browser Supabase client
│   │   ├── supabase-server.ts          # Server Supabase client
│   │   ├── utils.ts                    # Utility functions
│   │   └── menu-data.ts                # Complete menu data from PDF
│   └── types/
│       └── index.ts                    # TypeScript type definitions
├── public/
│   ├── logo.svg                        # Restaurant logo (HR SINCE 1950)
│   └── logo.png                        # Logo placeholder
└── README.md
```

## 🍽️ Menu Data (Extracted from PDF)

All menu data was extracted from `Patel Restaurant Menu.pdf` (12 pages, scanned document).

**Categories (26 total)**:
1. SOUP
2. VEG CURRIES
3. PANEER CURRIES
4. EGG CURRIES
5. TEA AND COLDRINKS
6. KHICHDA
7. SEEKH
8. Patel KEEMA
9. Patel KEBAB
10. SEA FOODS
11. EXTRA
12. Patel BIRYANI
13. Patel SPECIAL RICE
14. CHICKEN CURRIES
15. MUTTON CURRIES
16. VEG CHINESE
17. CHICKEN CHINESE
18. TANDOORI CHICKEN
19. FISH CURRIES
20. VEG CHINESE RICE
21. VEG CHINESE NOODLES
22. KEPSA ITEM
23. CHICKEN CHINESE RICE WITH GRAVY
24. CHICKEN CHINESE RICE
25. CHICKEN CHINESE NOODLES
26. CHICKEN CHINESE NOODLES WITH GRAVY

**Total menu items**: 240+ dishes with exact prices from the PDF

**Restaurant contact**:
- Phone 1: +91 9876543210
- Phone 2: +91 8765432109
- Developer: Salman Furniturewala (+91 7303321019)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd Patel-restaurant
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
copy .env.example .env.local     # Windows
cp .env.example .env.local       # macOS/Linux
```

You need:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Project Settings → API

### 3. Set Up Database

1. Create a free project at https://supabase.com/dashboard
2. Run the SQL migration from `supabase/migrations/0001_initial_schema.sql` in the SQL Editor
3. Enable email/password auth in Supabase Authentication settings
4. Add your localhost and production URLs to redirect URLs

### 5. Import Menu Data

After setting up Supabase, import the menu data:

```bash
# Visit the admin panel and use the import feature, or call the API:
POST /api/import
{ "importEverything": true }
```

### 6. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 for the public menu.
Open http://localhost:3000/login for admin login.

**Demo credentials**: admin@Patelrestaurant.com / admin123

## 📦 Deployment to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

### Option B: GitHub Integration

1. Push code to GitHub
2. Import repo at https://vercel.com/new
3. Add environment variables in Vercel project settings
4. Deploy

After deployment, add your Vercel URL to Supabase Authentication → URL Configuration → Redirect URLs.

## 🖼️ AI Image Generation

Each menu item needs a unique AI-generated food photograph. The master prompt is:

```
Create an ultra-realistic, premium restaurant menu food photograph of [DISH NAME].

Background: Dark charcoal black matte stone surface.
Lighting: Soft, warm professional studio lighting with subtle highlights.
Camera angle: 45-degree professional food photography angle.
Composition: Dish beautifully presented in a premium matte black ceramic plate or bowl.
Food should be the main subject, centred and clearly visible.
Realistic food texture, natural colours and appetising appearance.
Professional restaurant menu photography.
Ultra-sharp focus, high detail, realistic shadows.
Premium editorial food photography.
Square 1:1 aspect ratio.
```

**Image naming**: `dish-name.webp` (lowercase, spaces → hyphens)

**Storage**: Images are stored in Supabase Storage (persistent, works with Vercel).

**Note**: AI image generation requires an API key (OpenAI, Stability AI, etc.). Set `AI_IMAGE_GENERATION_API_KEY` in your environment variables. Without it, placeholder SVGs are used.

## 🔐 Admin Dashboard

- **URL**: /admin
- **Authentication**: Email + password via Supabase Auth
- **Protected routes**: All /admin/* routes require authentication
- **Public routes**: Menu page (/) works without login

### Admin Features:
1. **Dashboard** — Overview stats (categories, items, media, missing images)
2. **Menu Categories** — View, add, edit, delete categories
3. **Menu Items** — View, edit, delete items; change prices; assign images
4. **Media Library** — WordPress-style image management with preview, rename, replace, delete, download
5. **Restaurant Settings** — Configure branding and contact details

### Developer Credit (Locked):
"Developed by Salman Furniturewala" with tel:+917303321019 link
- Hardcoded in the footer
- NOT editable or removable from the admin dashboard

## ⚠️ Important Notes

1. **Supabase credentials are required** for the database to work. Without them, the app runs in a limited mode.
2. **AI image generation requires an API key**. Without it, placeholder images are shown.
3. **No ordering functionality** — this is a browse-only digital menu as specified.
4. **Developer credit is permanent** — cannot be removed or edited via admin.
5. **All images use persistent Supabase Storage** — survives redeployment.

## 🛠️ Tech Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- Supabase (Database, Auth, Storage)
- React 19
- Vercel (Deployment)
