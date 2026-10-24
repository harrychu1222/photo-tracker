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
   - **Projects & roles (stage 1 of project management):** run
     `supabase/migration_4_projects_roles.sql` once, **before** deploying the matching
     app code. It adds admin/crew roles, a real Projects table, and links your
     existing photos to projects (every project name you've already typed becomes a
     project; nothing is deleted). Everyone starts as **crew**. Then run this one line
     separately, with the email you log in with, and sign out and back in:
     `update public.profiles set role = 'admin' where email = 'YOUR-LOGIN-EMAIL';`
   - **Admin vs crew invite codes:** `invite_codes` now has a `role` column
     (`crew` by default). Add a row with `role = admin` to create an admin invite code.
     The role is read from the database, never from the browser, so it can't be
     self-assigned.
   - **Rooms & tasks (stage 2 of project management):** run
     `supabase/migration_5_rooms_tasks.sql` once, **before** deploying the matching app
     code (it needs migration 4 first). It adds a real list of rooms per project and a
     tasks table, and links photos to rooms and tasks. Rooms you've already typed on
     photos become real rooms automatically (capitalisation and stray spaces are merged,
     so "Kitchen" and "kitchen " become one room); nothing is deleted and it is safe to
     run twice. Rooms and tasks contain no money, so everyone signed in can see them and
     crew can add rooms and tasks and update progress on site. Only an admin, or whoever
     added a room or task, can delete it.
   - **Materials, equipment, bulk add and Team (stage 3 of project management):** run
     `supabase/migration_6_materials_equipment_team.sql` once, **before** deploying the
     matching app code (it needs migrations 4 and 5 first). It adds material and equipment
     lists per task, with prices in separate admin-only tables (crew can see what is needed
     but can never read a price), the "Add many" and "Copy to rooms" functions for tasks, a
     guard that stops "waiting on" chains from looping, and the function behind the Team
     screen. Safe to run twice; nothing existing is changed.
   - **Several "waiting on", material status and measurements (stage 4a):** run
     `supabase/migration_7_dependencies_status_measurements.sql` once, **before** deploying
     the matching app code (it needs migrations 4, 5 and 6 first). Your existing "waiting on"
     links are copied into a new table so nothing is lost (the old column is left in place and
     simply no longer used). It also adds the To order / Ordered / Delivered status for
     materials and a measurements table. Safe to run twice.
   - **If you deploy new app code before running a migration**, you may briefly see
     a banner like "column photos.taken_at does not exist" and existing photos may
     seem to disappear. Your data is safe — it's just an ordering query failing.
     The app now falls back automatically and keeps working with older photos while
     you go run the pending migration; new uploads will too, though without the
     newer field until the migration is applied. Running the migration clears it up
     immediately, no re-deploy needed.
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

### App icon

A simple, flat, modern camera mark has been generated for you, in the app's own
slate/amber palette — no extra step needed, it's already in `public/icons/`
(`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) and set as the favicon.
The source vector is `branding/icon-master.svg` if you ever want to tweak the design
(colors are the same hex values as `tailwind.config.js`) and re-export new PNGs at
those same three sizes/filenames.

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

- **Projects tab:** the app opens on Projects; a bottom tab bar switches between Projects,
  Photos and (for admins) Team. Projects
  are real records (name, client, site address, status, dates, notes) with a wider
  layout on a computer. Pick a project (or add one on the spot) when uploading or
  editing a photo; renaming a project renames it on all its photos. Admins also see
  a Money section per project (target cost, markup %, GST toggle) that crew cannot read —
  it lives in its own database table protected by security rules, not just hidden on screen.
- **Tasks and rooms:** open a project to see its Tasks tab (the project's to-do list).
  Each task has a room, a status (To do / In progress / Done / Blocked), a progress
  slider, planned start/end dates, planned man-hours, actual start/end dates, an optional
  "waiting on" task, notes and photos. Ticking a task done (or changing its status)
  stamps the actual dates for you, and each task shows how it is tracking against plan
  ("Overdue by 3 days", "Finished 1 day early", "4 days so far"). The Rooms button lists,
  renames, adds and deletes the project's rooms. The project list shows tasks done and an
  overall progress bar per project. When you add or edit a photo, choosing a project lets
  you pick one of its rooms and (optionally) one of its tasks.
- **Seeing dependencies:** the task list defaults to "By dependency": each task sits
  indented under the task it waits on, grouped by room. A task still held up shows a
  "Waiting on ..." badge and is greyed; when the task it waits on is finished it turns into
  "Ready to start"; a task that others are waiting on shows "Holding up N tasks". "By date"
  switches back to a flat list. A task can wait on **several** tasks (tick them all in the
  task form): it shows "Waiting on 2 of 3: X, Y" until every one is done, then "Ready to
  start". In the dependency view it is drawn once, under the task planned to finish last. A
  task cannot be set to wait on something that already waits on it, directly or down a chain
  (no loops); the database enforces this too.
- **Add many:** type or paste one task per line, choose one or more rooms, and every room
  gets the whole list. Start a line with `>` to make it wait on the line above (`>>` goes one
  step deeper; lines that share a level wait on the same parent). To wait on several tasks,
  name them: `Tile (after Plumbing, Electrical)` (the names must match lines above). Add `| 4`
  at the end for planned hours. A live preview shows what will be created and warns about a
  name that matches nothing.
- **Copy to rooms:** tick tasks in one room and copy them into one or several other rooms.
  "Waiting on" links between the copied tasks are rebuilt inside each new room. Copies start
  as To do, 0%, with no actual dates; planned dates and hours, notes, materials and equipment
  come along (prices come along only when an admin does the copy). Copied materials start as
  To order and are flagged "check quantity" until someone confirms or edits them, because the
  quantities were worked out for a different room.
- **Materials and equipment per task:** open a task to list materials (item, quantity, unit)
  and equipment (own tools, hired or bought items; tick an item once it is on site). Each
  material has a status, **To order, Ordered or Delivered** (tap the chip to move it on; the
  date is stamped automatically). A task card shows "3 of 5 materials delivered", and warns
  when the task starts within a week (or should have started) with materials still not
  delivered. Admins
  also enter prices (ex-GST), see line totals and a planned cost per task. The project's
  **Materials** tab lists everything by room and task, with a combined shopping list for
  ordering; admins also see the planned total against the target cost (labour is not
  included until stage 5). Crew see names and quantities only. The shopping list shows what
  is still to order.
- **Measurements:** the project's Measurements tab keeps sizes you will need again, per room
  or for the whole project (floor area, vanity width, benchtop length). When adding a material,
  "Fill the quantity from a measurement" copies the value in, with an optional waste % (14.5 m²
  plus 10% gives 15.95). The result is stored as an ordinary quantity. Measurements hold no
  money, so everyone can see and add them; copying tasks to another room does not copy them.
- **Team (admins):** the Team tab lists everyone with access and lets an admin make someone
  admin or crew without SQL. There must always be at least one admin.
- Coming in the next stages: expenses with receipt photos and the target / quote / actual
  header (stage 4b), payments received and a cash-flow graph (stage 4c), time entries for
  actual man-hours and labour cost (stage 5), then the Gantt chart.

- Upload from camera **or** photo library, one photo or several at once (bulk upload)
- Project, Room, and Category of work as separate fields (the underlying database
  column is still named `location` — only the on-screen label changed — so no
  migration was needed for this rename)
- Progress status (Not started / In progress / Complete / Blocked)
- Quoting status (Pending quotation / Quoted / Rejected), optional per photo
- Free-form tags
- Map location per photo: skip it, use your current GPS, or search for an address
  (autocomplete via OpenStreetMap's free Nominatim geocoder — type a few letters and
  pick a suggestion, or just leave your typed text and the app will try to resolve it)
- Dropdown filters for project, room, category, and tags, plus toggle filters for
  progress and quoting status, plus a text search box
- Map view — plots any photo with coordinates attached
- Timeline view — pick a project (and optionally a room) to see its photos in order
  by the date the photo was actually **taken** (read from the photo's EXIF data), not
  when it happened to be uploaded
- Before/after comparison — pick any two photos in Gallery view via "Compare", then
  drag the slider

### A note on the address search

Nominatim is free and needs no API key, which fits a free-tier project, but it's
rate-limited and meant for light use (roughly one search per second). That's plenty
for a small team adding photos one at a time. If this app ever needs heavy/bulk
geocoding, swap in a paid provider (e.g. Google Places Autocomplete, which needs a
Google Cloud billing account and an API key) in `src/components/Photos/AddressAutocomplete.jsx`
— the rest of the app only cares that it gets back `{ address, lat, lng }`.

### A note on the "taken" date

Most phone photos embed a capture date/time in their EXIF metadata, and the app reads
that automatically on upload (`src/lib/exif.js`). If a photo has no EXIF data at all
(e.g. a screenshot, or an image that's been re-saved/edited by another app and lost its
metadata), the app falls back to the file's last-modified time, which is usually close
enough. There's no way to recover an original capture date for a photo that never had
one — in that rare case you can manually correct it by re-uploading the original file.

## Ideas for later

- Offline capture (queue uploads locally when there's no signal, sync when back online)
- PDF/report export of a filtered set of photos
- Push notifications when new photos are added
- Client-side image compression before upload (saves storage + bandwidth on big bulk uploads)
- Auto-suggest location/room/category from past entries as you type
- CSV export of photo metadata for reporting
