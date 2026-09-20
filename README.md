# Site Log — Photo Tracker

A mobile-first PWA for tagging and tracking jobsite photos by location, category of
work, and progress status, with a filterable shared gallery. Built with React + Vite +
Tailwind, backed by Supabase (auth, database, storage). Access is invite-only via
shared codes.

## 1. Set up Supabase (5–10 min)

1. In your Supabase project dashboard, go to **Storage** → **New bucket**. Name it
   exactly `photos`, and leave it **private** (not public).
2. Go to **SQL Editor** → **New query**, paste the entire contents of
   `supabase/schema.sql`, and run it. This creates the tables, the invite-code signup
   trigger, and all Row Level Security policies (including the storage bucket
   policies — the `insert into storage.buckets` line in that script only fills in the
   bucket if it isn't already there, so running it after step 1 is fine).
   - **Already had this app running before?** Your existing database won't have the
     newer `room`, `quoting_status`, `lat`, and `lng` columns. Run
     `supabase/migration_2_room_quoting_map.sql` once — it only adds columns and
     never touches existing data. Then also run
     `supabase/migration_3_taken_at.sql` for the photo-taken-date column used by
     the timeline view.
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

## Current features

- Upload from camera **or** photo library, one photo or several at once (bulk upload)
- Location, Room, and Category of work as separate fields
- Progress status (Not started / In progress / Complete / Blocked)
- Quoting status (Pending quotation / Quoted / Rejected), optional per photo
- Free-form tags
- Map location per photo: skip it, use your current GPS, or type in coordinates manually
- Dropdown filters for location, room, category, and tags, plus toggle filters for
  progress and quoting status, plus a text search box
- Map view — plots any photo with coordinates attached
- Timeline view — pick a location (and optionally a room) to see its photos in order
  by the date the photo was actually **taken** (read from the photo's EXIF data), not
  when it happened to be uploaded
- Before/after comparison — pick any two photos in Gallery view via "Compare", then
  drag the slider

### A note on the "taken" date

Most phone photos embed a capture date/time in their EXIF metadata, and the app reads
that automatically on upload (`src/lib/exif.js`). If a photo has no EXIF data at all
(e.g. a screenshot, or an image that's been re-saved/edited by another app and lost its
metadata), the app falls back to the file's last-modified time, which is usually close
enough. There's no way to recover an original capture date for a photo that never had
one — in that rare case you can manually correct it by re-uploading the original file.

## Ideas for later

- Offline capture (queue uploads locally when there's no signal, sync when back online)
- Role-based permissions (e.g. viewer vs. uploader vs. admin) beyond "owns the photo"
- PDF/report export of a filtered set of photos
- Push notifications when new photos are added
- Client-side image compression before upload (saves storage + bandwidth on big bulk uploads)
- Auto-suggest location/room/category from past entries as you type
- CSV export of photo metadata for reporting
