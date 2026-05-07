# GYMPODS OPS — Deployment Guide

## Step 1 — Set up the database

1. Go to your Supabase project: https://sdfoakmwefirdcwugqqc.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `setup.sql` and click **Run**
4. You should see "Success" — this creates all tables and seed data

---

## Step 2 — Run the app locally

In your terminal, from the `gympods-ops` folder:

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser (or on iPad, use your computer's local IP).

---

## Step 3 — Deploy to Vercel

### Option A: Via Vercel dashboard (easiest)
1. Push this folder to a GitHub repository
2. Go to vercel.com → Add New Project
3. Import your GitHub repository
4. Leave all settings as default and click Deploy
5. Done — Vercel gives you a live URL

### Option B: Via Vercel CLI
```bash
npm install -g vercel
vercel
```
Follow the prompts.

---

## Default login PINs

| Name           | PIN  | Role    | Site    |
|----------------|------|---------|---------|
| Admin (Dalston)| 1234 | Admin   | Dalston |
| Admin (Putney) | 5678 | Admin   | Putney  |
| HQ Admin       | 9999 | HQ      | Dalston |

**Change these PINs via Staff Management after first login.**

---

## What's built in Phase 1

- ✅ PIN login (4-digit, per staff member)
- ✅ Site-specific configuration
- ✅ 4 shifts per day (Early Morning, Mid Shift, Evening, Overnight)
- ✅ Task library with categories (Cleaning, H&S, Maintenance, Opening/Closing)
- ✅ Shift builder — assign tasks to shifts with ordering
- ✅ FOH shift task completion with comments
- ✅ Issue flagging with description and photo upload
- ✅ Manager dashboard — today's overview and open issues
- ✅ Staff management — add/edit/disable staff
- ✅ Issues management — view, detail, resolve
- ✅ HQ network view — all sites overview
- ✅ 5-year data retention (all records stored permanently in Supabase)

## Phase 2 additions (future)
- WhatsApp alerts for flagged issues
- Language switching
- Training video library
- Advanced analytics and reporting
- BreatheHR / rota integration (optional)
