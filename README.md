# Site Log — Photo Tracker

A mobile-first PWA for tagging and tracking jobsite photos by location, category of
work, and progress status, with a filterable shared gallery. Built with React + Vite +
Tailwind, backed by Supabase (auth, database, storage). Access is invite-only via
shared codes.

## 1. Set up Supabase (5–10 min) new commit

1. In your Supabase project dashboard, go to **Storage** → **New bucket**. Name it
   exactly `photos`, and leave it **private** (not public).
2. Go to **SQL Editor** → **New query**, paste the entire contents of
   `supabase/schema.sql`, and run it. This creates the tables, the invite-code signup
   trigger, and all Row Level Security policies (including the storage bucket
   policies — the `insert into storage.buckets` line in that script only fills in the
   bucket if it isn't already there, so running it after step 1 is fine).
3. Go to **Authentication** → **Providers** → confirm **Email** is enabled. Under
   **Authentication** → **URL Configuration**, add your dev URL
   (`http://localhost:5173`) and your future production URL as Redirect URLs.
4. (Optional) Under **Authentication** → **Emails**, you can customize the
   confirmation email, or under **Authentication** → **Providers** → **Email**,
   turn off "Confirm email" if you'd rather skip the email-confirmation step for a
   small trusted team.

### Creating invite codes

Codes are stored in `public.invite_codes` and are not readable or writable from the
app on purpose — this is exactly what makes them safe to hand out. To create one, go
to **Table Editor** → `invite_codes` → **Insert row**, e.g.:

| code | label | max_uses | expires_at |
|---|---|---|---|
| `CREW-2026` | Fall crew invite | `10` | *(leave blank for never)* |

Share the code (`CREW-2026`) with whoever you want to grant access — that's the
"permitted people" gate. Each code can be used up to `max_uses` times; after that,
signup with that code fails. Make a new code any time you want to invite more people.

## 2. Run it locally

```bash
npm install
cp .env.example .env
# edit .env with your Supabase project URL + anon key (Settings > API in the dashboard)
npm run dev
```

Open the printed localhost URL. Sign up with an invite code you created above.

## 3. Deploy it (so it works on iPhone)

Push this folder to a GitHub repo, then import it into **Vercel** (or Netlify):

1. New Project → import the repo.
2. Framework preset: Vite (auto-detected).
3. Add the two environment variables from your `.env` (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in the project's Environment Variables settings.
4. Deploy. Add the resulting `https://your-app.vercel.app` URL to Supabase's
   Redirect URLs list (Authentication → URL Configuration) too.

### Add real app icons

The PWA manifest expects PNG icons at `public/icons/icon-192.png`,
`icon-512.png`, and `icon-512-maskable.png` — see `public/icons/README.md` for the
quickest way to generate them from a logo or the included placeholder SVG. Without
them the app still works, just with a generic icon on the home screen.

### Add to iPhone home screen

Open the deployed URL in **Safari** on the iPhone → tap the **Share** icon → **Add to
Home Screen**. It'll launch full-screen, like a native app, using the manifest and
icons above.

## How access & data work

- **Sign-up requires a valid invite code.** This is enforced in the database (a
  Postgres trigger on `auth.users`), not just in the app, so it can't be bypassed.
- **Every signed-in user sees every photo** — it's a shared team gallery — but can
  only edit or delete their own uploads.
- Photos are stored in a **private** Supabase Storage bucket; the app generates
  short-lived signed URLs to display them, so nothing is publicly accessible by URL
  guessing.
- The gallery updates live across devices via Supabase Realtime — if a teammate
  uploads a photo, it appears in your gallery without a refresh.

## Project structure

```
src/
  components/Auth/       Login, SignUp
  components/Layout/     Header
  components/Photos/     Gallery, FilterBar, PhotoCard, PhotoDetail, UploadModal, TagInput
  context/AuthContext.jsx
  hooks/usePhotos.js     all Supabase reads/writes for photos
  statusConfig.js        the 4 progress-status options (edit here to change them)
supabase/schema.sql      run once in the Supabase SQL editor
```

## Ideas for later

- Offline capture (queue uploads locally when there's no signal, sync when back online)
- Before/after photo comparisons for the same location over time
- A map view pinning photos by GPS location
- Role-based permissions (e.g. viewer vs. uploader vs. admin) beyond "owns the photo"
- PDF/report export of a filtered set of photos
- Push notifications when new photos are added
