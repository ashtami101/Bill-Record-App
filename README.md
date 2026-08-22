# BillTrack Pro

Contractor bill tracking app with:
- **Login** — email + password, powered by Supabase Auth (sign in and create-account are both on the same login screen)
- **Database** — Supabase (`kv_store` table) instead of the old browser-only storage; all signed-in users share the same bill data
- **Hosting** — Vercel, deployed straight from GitHub

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Note the project's **Project URL** and **anon public key** (Project Settings → API) — you'll need both shortly.
2. In the Supabase dashboard, open **SQL Editor → New query**, paste in the contents of `supabase.sql` (included in this repo), and run it. This creates the `kv_store` table and the row-level security policies that let each signed-in user read/write shared data.
3. In **Authentication → Providers**, confirm **Email** is enabled (it is by default).
   - If you'd rather skip email confirmation for a quick internal tool, go to **Authentication → Settings** and turn off "Confirm email." Otherwise, new accounts will need to click a confirmation link before they can sign in.

## 2. Run it locally

```bash
npm install
cp .env.example .env
# edit .env and paste in your Project URL and anon key
npm run dev
```

Open the local URL Vite prints. You'll land on the login screen — use **Create Account** to make your first user, then sign in.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

`.env` is git-ignored on purpose — never commit real keys. Vercel gets them separately (next step).

## 4. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo you just pushed.
2. Vercel auto-detects Vite. Framework preset: **Vite**, build command `npm run build`, output directory `dist` — leave the defaults.
3. Before deploying, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Click **Deploy**. Every future push to `main` redeploys automatically.

## Notes

- The anon key is safe to expose in frontend code — it's designed for that. Access control is enforced by the row-level security policies in `supabase.sql`, not by hiding the key.
- All bills are stored as one shared JSON blob under the key `billtrack:bills` — fine for a small team's dataset. If this grows large or you want per-bill queries/reporting at the database level, the natural next step is a proper `bills` table with real columns instead of the JSON blob; ask if you'd like that migration.
- To add a teammate, either have them use **Create Account** on the login screen, or add them directly from **Authentication → Users → Add user** in the Supabase dashboard.
