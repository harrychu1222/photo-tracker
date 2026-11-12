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
   - **Room sizes, openings and delivery dates (stage 4b-1):** run
     `supabase/migration_8_room_sizes_dates.sql` once, **before** deploying the matching app
     code (it needs migrations 4 to 7 first). It adds length / width / height and manual areas
     to rooms, door / window openings to measurements, and an expected delivery date to
     materials. Existing rooms and measurements are kept as they are. Safe to run twice.
   - **Expenses and receipt photos (stage 4b-2):** run
     `supabase/migration_9_expenses.sql` once, **before** deploying the matching app code (it
     needs migrations 4 to 8 first). It adds the expenses table (admins see everything, crew
     only the expenses they entered) and a private `receipts` storage bucket. Nothing existing
     is changed. Safe to run twice.
   - **Payments received and cash flow (stage 4c):** run
     `supabase/migration_10_payments.sql` once, **before** deploying the matching app code (it
     needs migrations 4 to 9 first). It adds an admin-only payments table. Nothing existing is
     changed. Safe to run twice.
   - **Hours and labour cost (stage 5):** run `supabase/migration_11_time_labour.sql` once,
     **before** deploying the matching app code (it needs migrations 4 to 10 first). It adds
     time entries (crew see only their own), admin-only hourly rates, and a labour lump-sum
     option on each project. Nothing existing is changed. Safe to run twice.
   - **People without a login, one-off rates and per-task lump sums (stage 5 follow-up):** run
     `supabase/migration_12_workers_rates_lumps.sql` once, **before** deploying the matching
     app code (it needs migrations 4 to 11 first). Any project-wide lump sum you set after
     migration 11 is moved into the new lump-sum list (and from then on it is added to hours x
     rates instead of replacing them). Safe to run twice.
   - **Quote set-up and actual project dates (stage A):** run
     `supabase/migration_13_quote_dates.sql` once, **before** deploying the matching app code
     (it needs migrations 4 to 12 first). It adds actual start/end dates to projects and the
     quote set-up fields (build-up estimates, lump-sum quote price) to the admin-only finance
     table. No existing figure is changed. Safe to run twice.
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
  a Money section per project (quote set-up, target cost, markup %) that crew cannot read —
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
  date is stamped automatically). Tap the date line under a material to edit the ordered,
  expected-delivery and delivered dates (the status follows the dates; a past expected date
  with nothing delivered shows "Late by N days"). A task card shows "3 of 5 materials
  delivered", and warns when a delivery is expected after the task starts, or when the task
  starts within a week (or should have started) with materials still not delivered. Admins
  also enter prices (GST included), see line totals and a planned cost per task. The project's
  **Materials** tab lists everything by room and task, with a combined shopping list for
  ordering; admins also see the planned total against the target cost (labour is not
  included until stage 5). Crew see names and quantities only. Filter the tab by status
  (All / To order / Ordered / Delivered) and by room; the "Combined list" button adds up
  whatever is currently shown, so "To order" gives your buying list.
- **Measurements and room sizes:** the project's Measurements tab has a card for each room.
  Type the room's **length, width and height** once (in mm by default, or switch the room to
  m; the numbers convert) and the app works out the floor and ceiling area, each long and
  short wall, all four walls, and the perimeter (skirting / cornice length). Under the sizes,
  add **special measurements** (vanity width, glass length) and **doors / windows**, typed as
  width and height: their area is taken off the walls, and the card shows the walls before
  and after openings. A room that is not a simple box (an L-shape, an alcove) can switch to
  "type the areas myself". When adding a material, "Fill the quantity from a measurement"
  offers every calculated figure and special measurement, with an optional waste % (31.9 m²
  of walls plus 10% gives 35.1). The result is stored as an ordinary quantity. Measurements
  hold no money, so everyone can see and add them; copying tasks to another room does not
  copy them.
- **Team (admins):** the Team tab lists everyone with access and lets an admin make someone
  admin or crew without SQL. There must always be at least one admin.
- Coming in the next stages: expenses with receipt photos and the target / quote / actual
  header (stage 4b-2), payments received and a cash-flow graph (stage 4c), time entries for
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

### Money without GST maths (stage A)
- **Everything is entered as paid or received, GST included.** There are no GST ticks,
  toggles or conversions any more. Figures entered earlier stay exactly as typed (the
  database columns are still named `amount_ex_gst`, they now simply hold the amount as paid).
- **Quote price = the final amount the client pays.** Project edit > Quote offers two modes:
  *Build up from estimates* (estimated materials, equipment, labour, subcontractors and
  other, plus a markup %; target cost = their sum, quote = target x (1 + markup)) or
  *Lump sum* (type the quote price; a target cost is optional). "Fill from task plan" copies
  planned materials and equipment from the tasks, and labour as planned hours x the average
  usual hourly rate. An older typed-in target cost keeps working until estimates are entered.
  Projects that previously added GST on top of the quote now show the quote without it.
- **Dates:** planned start/end and actual start/end. Actual start shows the first task start
  automatically, and marking the project Complete fills the actual end date; both are
  editable. "Use task dates" fills the planned dates from the tasks.
- **Money box (admins):** Quote price, Target cost, Expected margin, then Materials,
  Equipment, Other expenses, Labour (hours x rates) and Subcontractors (lump sums plus
  subcontractor-category expenses), each with its estimate beside the actual, flagged when
  over. Then Total spent, Received and Still to receive.
- **Materials tab (admins):** planned against actual for Materials and Equipment, with the
  difference, plus a note for materials spending not linked to a line.
- The **Time** tab is now **Labour** (crew still see **My hours**). Task progress moves in
  10% steps. Waste fields say what to type (e.g. 10 for 10%). Equipment and tool costs are
  labelled inc GST.

### Expenses (stage 4b-2)
- Project > **Expenses** tab: date, supplier, description, category (Materials / Equipment
  hire / Subcontractor / Other), amount and an optional receipt photo (camera or library;
  shrunk before upload and kept in a private bucket).
- Amounts are entered as paid, GST included. A minus sign records a refund or credit.
- Optionally link an expense to one material line. Admins get the planned cost filled in
  (editable). If that material is still "To order", you are asked "Mark as ordered?".
- Anyone can add expenses. Crew see and edit only their own, with no totals or prices.
  Admins see everything, totals by category and who entered each one.
- Admin money box: Target cost, Quote price (target + markup + GST), planned materials +
  equipment, and Actual spent, flagged over or under target. Labour is not included yet.
- Materials tab (admins): each line shows what was paid against the planned cost.

### Payments and cash flow (stage 4c, admins only)
- Project > **Cash flow** tab: record payments received (date, description such as Deposit or
  Progress claim 2, amount as received). Crew never see this tab.
- Line graph of cumulative **spent** (expenses) and **received** (payments) over time, with a
  faint line for the quote price. Buttons show or hide a total-spent line and a net line
  (received minus spent).
- Money box also shows Received and Still to receive (quote minus received).
- Reading the figures: tap or drag across the graph to see the exact spent / received / net
  for any date (the latest figures show by default); end-of-line figures are printed on the
  graph; the axis uses full dollar amounts; "Show figures" lists every date's running totals.

### Hours and labour (stage 5)
- Project > **Time** tab (crew see **My hours**): log date, hours, optional task and note.
  Task pickers show the room as well as the task ("Kitchen — Plaster walls").
  Crew log and see only their own hours (no dollars, no rates). Admins see everyone's.
- **Who worked** (admins): pick an account holder, a person you have typed in before, or
  "+ Someone else (type a name)". A typed name is saved as a new person (same name in a
  different case or spacing reuses the existing one) and can be picked from then on. These
  people have no login and do not appear in the Team screen.
- **Hourly rates** (admins): set a usual rate per person (Labour tab > Usual hourly rates), as paid.
  A rate that varied can be typed on the entry itself ("Hourly rate for this entry"); an entry
  rate is only kept when it differs from the usual rate. Changing someone's usual rate
  re-prices their hours that have no entry rate. People with hours but no rate are flagged and
  cost $0 until a rate is set.
- **Lump sums** (admins): add a lump sum with a description, optional task, amount (as paid) and
  date, for subcontracted or fixed-price work. Lump sums are **added on top of** hours x rates.
  If you tick "hours logged on this task are already covered", the hours on that task are
  kept in the record but not costed again.
- Task rows show "7.5 h logged of 4 h planned" (crew see only their own logged hours).
- Labour (hours x rates + lump sums) is added to **Actual spent** in the money box, with
  subcontractor-category expenses counted as labour too. The money box shows "Materials,
  equipment & other expenses" and "Labour & subcontractors" separately.
- The cash-flow graph has separate **Materials & equipment** and **Labour** lines plus
  Received, with optional Total spent and Net lines.  The Labour line includes subcontractor lump sums and invoices.

### Gantt chart (stage 6, view only)
- Project > **Gantt** tab (everyone sees it; no money on it). Each task with a planned start
  and/or end is a bar on a timeline: the bar's colour is the task status and the solid part
  shows % complete. A thin dark bar underneath shows the actual dates (faded while the task is
  still open). A red line marks today; the chart opens scrolled to it.
- Arrows run from a task to the tasks waiting on it. An arrow is red and dashed when the
  waiting task is planned to start before (or on the day) its blocker finishes. A red outline
  means the planned end date has passed and the task is not done.
- Tap a bar or task name for details (room, status, planned and actual dates, what it waits
  on, warnings). Days / Weeks / Months change the zoom (the best fit is picked at first);
  filter by room, hide done tasks, or turn room grouping off. Tasks with no planned dates are
  listed underneath. Nothing here changes data, and no database migration is needed.

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

## New look: Site Log shell and project screen (stage B1 + B2)

No database changes and no new migration. The money, quote and access rules are untouched.

- **Shell:** on a computer there is a dark side menu (Projects, Photos, Team, the active projects, Add photo, Sign out). On a phone there is a top bar and a bottom bar with Add photo in the middle. Only one of the two is built at a time.
- **Project screen:** tabs are now Overview, Plan, Materials, Money and Photos. Crew see "Hours & expenses" instead of Money.
  - **Plan** holds Tasks, Gantt and Measurements.
  - **Money** holds Cash flow, Expenses and Labour (admins). Crew see Expenses and My hours.
  - **Overview** is new: progress, schedule, spent and received tiles (crew see progress, schedule and My hours), a Needs attention list, the money box (admins), recent photos and the project details.
- **Needs attention** (`src/lib/attention.js`) lists overdue tasks, blocked tasks, deliveries past their expected date, and spending that is 10 points or more ahead of progress. Tapping an item opens the right tab.
- **Schedule chip:** "N days behind" is the longest-overdue open task.
- Defects is left out until its own stage.
- Colours stay graphite and safety amber (see `tailwind.config.js`); icons are in `src/components/ui/Icon.jsx`.

## Gantt restyle (stage B3)

No database changes. On the Plan > Gantt view:
- The task column is wider on a computer, and under the task bars there are lanes on the same dates: **Deliveries** (expected date, red when late, green when arrived), **Hours logged** (per week) and **Cash flow** (spent and received, admins only). Each lane can be switched off with its button.
- On a phone the Gantt opens as an **Agenda**: a date rail with what is due each day, overdue first, plus expected deliveries. Tap a task to see it on the Timeline. The Agenda/Timeline switch is at the top.

## Final polish (stage B4)

No database changes. Add task opens as a panel sliding in from the right on a computer (a bottom sheet on a phone). Main amber buttons now use dark text so they read clearly. On phones and tablets every text box and dropdown is at least 44px tall.

## Fix-up round, Kanban board and Materials upgrade (stages C1 + C2 + C3)

**Run `supabase/migration_14_loose_materials.sql` first** (safe to run twice). It lets a material exist without a task.

- **Money box:** Estimate and Actual line up in fixed columns, and **Net** (received minus total spent) sits after Received.
- **Rooms:** rooms can be renamed in Measurements, and Add room is at the top.
- **Gantt:** start and end date columns next to each task (computer only), stronger cell borders, a gap between the task rows and each lane, and a dollar axis on the cash-flow lane.
- **Cash flow tab:** a smaller graph, Total spent, Received and Net always shown, Labour and Materials & equipment optional, and Add payment received at the top.
- **Plan > Board:** tasks as cards in To do, In progress, Blocked and Done columns, with a room filter above. Drag a card on a computer, or use the buttons on a phone.
- **Materials tab:** a delivery timeline at the top, and an Add material form. A material can be added with no task, listed under "No task yet", and linked to a task later.

## Fix-up round + C4 (new-project questionnaire)

Run `supabase/migration_15_supplier_room_level.sql` first (and migration 14 if not yet run).

- Dates are fixed `dd/mm/yyyy` everywhere in the project views (no more locale-dependent text).
- Cash flow chart is smaller.
- Plan > Tasks has one List / Board switch (no separate Board tab).
- Materials have an "Ordered from (shop)" field.
- **+ New project** now opens a 4-step questionnaire: Project, Levels, Rooms (counts per level, custom rooms), Review. Rooms are created with their level. "Skip the questions" opens the old full form.

## C5 (task templates in the questionnaire)

Run `supabase/migration_16_task_templates.sql` (only needed for "Save as my template"; everything else works without it).

- New questionnaire step **Tasks** (between Rooms and Review): each room gets a standard list (Kitchen, Bathroom/Ensuite, Toilet, Laundry; Flooring can be picked for any room). Untick tasks, edit hours, add your own, tick/untick each task's suggested materials and tools.
- Waiting-on links follow the list; removing a task relinks the next one to the one before it.
- **Save as my template** stores a room's list (room type, tasks, hours, links, materials, tools); it then appears in every room's template menu as "(mine)".
- Material quantities from templates are starting points; fix them on the Materials tab once measured.
- Review lists rooms grouped by level; with rooms on two or more indoor levels every room name carries its level (Ground Bathroom 1, Level 1 Bathroom 1).
- Standard lists live in `src/lib/templates.js`.

### C5 follow-up
- Template tasks now get planned dates (working days, 8 h a day, each task starts after the ones it waits on), so they show on the Gantt. Start = project start date, or today.
- Plan > Tasks has a **From template** button: pick a room and a template, tidy the list, set the first start date, add. Shared checklist component: `TemplateChecklist.jsx`; scheduling in `lib/templates.js`.

## Stage D + comment round

Run `supabase/migration_17_measurement_groups_deduct.sql` (adds `group_name` and `deduct` to measurements).

- **Questionnaire Tasks step:** each task has "Materials & tools" you can edit: change name/quantity/unit, remove, or add your own materials and tools.
- **Plan > Tasks > From template:** opens on the room's own standard list; tasks already in the room are tagged and unticked. Rooms with a standard list but no tasks show a "Rooms with no tasks yet" bar with a + button each.
- **Level filter** (All levels / Ground / Level 1 ...) on Plan > Tasks, Board and Gantt; one shared filter. Room chips follow the level.
- **Measurements:** each door/window has "Take its area off the wall area" (tick/untick; wall figures only count ticked ones). Special measurements are named groups with several values (Vanity: width, height off floor); "+ Value" adds more to a group.

## Stage E (defects + all-projects overview)

Run `supabase/migration_18_defects.sql`.

- **Project > Defects tab:** add a defect (what is wrong, room, related task, priority, notes), Start work / Mark fixed / Reopen, edit, delete (admin or whoever added it). Filters: Open / Fixed / All, level, room. The tab shows the open count; the project header shows "N open defects"; Overview > Needs attention lists them (urgent ones in red, with the oldest age).
- **Projects > Overview** (switch at the top of the project list): tiles for projects behind plan, late deliveries, open defects and (admin) net; a combined cash-flow graph of all shown projects (admin); one card per project with progress, schedule, late deliveries, defects and (admin) spent / received / net. Tap a card to open the project. Complete projects are hidden unless you tick "Include complete projects". Figures come from the same functions as the project screen (`src/lib/overview.js`).

## Overview rework + F1 (quote PDF, payment schedule)

Run `supabase/migration_19_quote_payments.sql`. `npm install` is needed once (adds `pdf-lib`, loaded only when you create a PDF).

- **Projects is now one screen:** totals across the projects shown (behind plan, late deliveries, open defects; admin also Received, Spent, Net, Still to receive), then one big card per project (progress, schedule, late deliveries, defects, photos; admin: Quote / Received / Spent / Net and the next payment). Tap a card to open the project. The separate Overview switch and the combined graph are gone.
- **Money > Quote & payments (admin):**
  - *Payment schedule:* named payments with amount (or % of the quote) and optional due date; "Start with deposit 20%, progress 40% and 30%, final 10%"; Mark received (records a payment under Cash flow, with the date you choose) and Undo received (removes that payment); totals show scheduled, received, still to come and what is not yet scheduled (or over the quote).
  - *Quote PDF:* asks for your business details (name, ABN, phone, email, address, terms, days valid), saved for next time; optional scope notes; optionally lists the tasks by room and the payment schedule; text only; shows the GST-included price and the GST amount, with a signature block. File: `Quote - <project> - <date>.pdf`.
- Overdue payments appear under Needs attention and on the project card.

## F2 + quote wording
- Run `supabase/migration_20_assign_quote_wording.sql` (adds `tasks.assigned_user` and the `project_quotes` table, admin-only).
- Tasks can be assigned to anyone with a login (task form → "Assigned to"). Plan/Board have an "Assigned to" filter.
- **My Day** (main nav): your assigned tasks as Overdue / Today / This week / No dates, with Start and Done buttons. Admins can view anyone's.
- Quote wording: Money → Quote & payments → "Edit quote wording". Each task becomes an editable scope line with materials/grade details; the price heading and GST line are editable too. Saved per project.
- Workers without logins can't be assigned yet.

## F3 + assign by name
- Run `supabase/migration_21_assign_by_name_site_diary.sql` (adds `tasks.assigned_name`, `diary_entries`, `compliance_items`).
- **Assign by name:** in the task form choose "Someone else (type a name)…" for a worker without a login. Typed names are remembered and offered next time; the Assigned-to filter and the manager's My Day picker list them. (Workers can't log in to see their own day; the manager reads it for them.)
- **Site diary** (project → Site diary → Diary): date, weather, who was on site (pre-filled from in-progress jobs), what was done, delays/issues. Authors and admins can edit/delete.
- **Compliance checklists** (Site diary → Checklists): start from site safety, waterproofing, plumbing, electrical or handover, edit the items, tick off (date recorded), add notes such as certificate numbers. Check the items against your state's rules.

## F3b + F4 (CSV export)
- Run `supabase/migration_22_workers_templates_issues.sql` (worker names list, checklist templates, resolvable diary issues). It also carries over existing typed names and old issue text.
- **Worker names:** My Day → "Manage workers" (managers): add, rename (updates their tasks), remove (unassigns open tasks; finished tasks keep the name).
- **Checklist templates:** "Save as my template" on any checklist (managers); your templates show under "Start from → My templates" on every project. Saving under the same name overwrites.
- **Diary weather** is multi-select. **Issues** are separate items under a diary entry; anyone can add one, managers mark it Resolved/Not resolved with a date and comment (and can reopen). Open issues show on the Site diary tab and in "needs attention".
- **Export (CSV):** project screen → Export, or Projects → Export all. Tasks, materials, measurements, defects, diary + issues, checklists, labour hours; managers also get expenses, payments received, payment schedule (plus an all-projects summary). Dates dd/mm/yyyy, amounts GST-included, expenses/payments have a "GST part (amount / 11)" column. Date range presets (this/last financial year, custom) apply to expenses, payments and labour. No new dependency (small built-in zip writer).

## F5: client progress link
- Run `supabase/migration_23_client_link.sql` (tables `client_links`, `client_shared_photos`, public bucket `client-photos`, function `client_view`).
- Project → **Share with client** (managers only): create a link (30/90/180 days or no expiry), tick the photos the client may see, copy the link. The client opens it with no login and sees the schedule (task names, rooms, dates, progress) and the ticked photos. Never money, notes, hours, defects, diary, checklists or worker names; "blocked" shows as "Not started".
- Security: the link is `https://your-site/#c=<256-bit secret>`. The part after `#` is never sent to a server in a request. Only the SHA-256 hash is stored, so the link can't be read back later (make a new one if lost; it replaces the old). The public page can only call `client_view(token)`, which returns a fixed set of fields, or nothing for a wrong, expired or switched-off link. The new tables are manager-only (RLS). The page sends `noindex` and no-referrer.
- Photos: ticked photos are copied into the separate public bucket under random names (the private `photos` bucket is untouched). Unticking, or "Stop all sharing", deletes the copies. Anyone who already knows a copy's exact URL can open it until it's deleted, so use "Stop all sharing" if a link is ever sent to the wrong person. Deleting a project or photo removes the database rows but not the copies; use "Stop all sharing" first.

## F5b: completed-task photos, My Day by worker, link expiry
- Run `supabase/migration_24_client_photos_by_task.sql` (after migration 23). The Edge Function `client-photos` (`supabase/functions/client-photos/index.ts`) must be deployed; it already is on the "Photo Tag App" project. To redeploy: Supabase dashboard → Edge Functions → client-photos, or `supabase functions deploy client-photos`.
- The client page now shows, under each task, the photos linked to that task once the task is Done. Managers can untick a photo to hide it, or tick any other photo to show it (under "More photos" if it has no task). Only differences from that default are stored (`client_photo_choices`).
- Photos are no longer copied into a public bucket. The function checks the link, then returns one-hour signed addresses for the private photos. Leftover public copies from the first version are deleted when the share dialog opens. The empty `client-photos` bucket and the `client_shared_photos` table can be dropped later.
- Link expiry options: 3 days, 7 days (default), 30 days, 90 days, no expiry.
- My Day, "Everyone's tasks": each section (Overdue, Today, Coming up, No dates) is split by worker.
- Photos only show on the client page if they are linked to a task, so ask the crew to pick the task when they add photos.

## Companies (M1) - separate space for each company (database part)

`supabase/migration_25_companies.sql` gives every company its own private space. Your current data becomes the first company ("My company"; rename it later). Nothing is deleted.

**Do this in order:**
1. **Back up first.** Supabase dashboard > Database > Backups (or export the tables). Do not skip this.
2. Run `migration_25_companies.sql` in the SQL editor, then **immediately push this version of the app** (two save calls changed: business profile and checklist templates). Between the two steps those two saves may fail; everything else keeps working.
3. Make yourself the app owner, once (put your own login email in):
   `insert into platform_owners(user_id) select id from profiles where lower(email)=lower('YOUR EMAIL') on conflict do nothing;`
4. Check you still see all your projects and the team list, and that crew still cannot see money.

**What it guarantees (tested on a real Postgres with two companies, 84 checks):** people only see and change their own company's rows in every table; money stays manager-only; a row cannot point at another company's project/task; photos and receipts files are company-scoped (this also fixes an old gap where any signed-in user could open any photo file); the app owner sees nothing inside a company unless they start a read-only, logged support session with a reason; a suspended company is locked out; client links still work.

**New tables you add later must have a `company_id` column** (see the end of the migration). The screens for creating companies, inviting people and the owner's Platform view come in the next stage; until then new people join with the existing invite codes (they join your company).

## Companies (M2) - screens

- **Team** (managers): "Invite someone" makes a one-use code (crew or admin, valid 14 days) to send to the person; unused codes are listed with Remove. "Company name" renames your company; the name shows in the header/side menu.
- **Platform** (app owner only, after the owner statement from M1): list of companies with people/project counts, "Add a company" (you type the company name, a manager code and an optional crew code; needs `migration_26_company_codes.sql`), Suspend/Reactivate, "View inside" (asks for a reason, then a read-only banner shows until you stop; every look is in the Access log).
- Run `migration_26_company_codes.sql` after migration 25 (replaces the company-creation function so you choose the codes). Manager code: one use, 30 days. Crew code: up to 100 people, 1 year. Codes are case-sensitive, 6-40 characters, no spaces.

## Stage 1 - housekeeping and trust

Run `supabase/migration_27_remove_people_feedback.sql` (after 25 and 26), then push the app.

- **Remove a person** (Team page): they lose all access and see "You no longer have access". Their name stays on old tasks, photos and entries. A "Removed people" list lets you Restore them. You can't remove yourself or the last manager.
- **Send feedback**: "Feedback" in the top bar (phone) or "Send feedback" in the side menu (computer). Only the app owner reads it, on the Platform page.
- **Platform**: "Add code" per company (extra manager or crew code), plus the feedback list.
- **Forgot password**: link on the sign-in screen. **In Supabase > Authentication > URL Configuration, set Site URL to your live app address and add it under Redirect URLs**, otherwise the reset email link will not return to the app. Also check Authentication > Providers > Email has "Confirm email" turned on.
- **Privacy and Terms**: public pages at `/#privacy` and `/#terms`, linked from sign-in and sign-up (sign-up has an "I agree" tick). They are plain-English drafts in `src/components/Legal/LegalPage.jsx`; have a lawyer review and edit before selling. Add your support email there.
- Invite codes are no longer shown in capitals on the sign-up screen (they are case-sensitive).

## Stage 2 - simpler for crew, easier entry, Undo

No database change. Push the app.

- **Crew home is My Day** (first tab, and the app opens on it). Crew nav: My Day, Projects, Photos.
- **Crew project view is shorter:** Tasks, Materials, Hours & expenses, Photos, Defects, Site diary. No Overview, Gantt, Measurements, Board, rooms/template/bulk tools or Export (managers keep all of these).
- **My Day cards:** Start, Done, **Photo** (opens the upload form with the project, room and task already filled in), **Note** (adds a dated line to the task's notes).
- **Photo upload is shorter:** project (remembered from last time), room, task and notes. Category, status, tags and map sit behind "More details".
- **Undo:** a bar appears for 8 seconds after marking a task Started/Done, adding a note, or deleting a diary entry, issue, checklist item, defect or measurement. Those deletes no longer ask "are you sure?". Deletes that remove files or several linked records (photos, tasks, expenses with receipts, projects) still ask first, because they can't be fully undone.

## Stage 3 - first-run help and search

No database change. Push the app.

- **Get started checklist** (managers, top of Projects): three steps that tick themselves: create your first job, take your first photo, invite your crew. "Start" opens the guided job setup (levels, rooms, template tasks, dates). It disappears when all three are done, or with "Hide".
- **More templates:** Deck and Fencing join Kitchen, Bathroom, Toilet, Laundry and Flooring. They are picked up automatically when you choose a Deck or Fencing room (Exterior level) in the job setup.
- **Search** (magnifier in the phone header, "Search" in the computer side menu): one box over projects, tasks (and their notes), photos (notes, tags, room, category, location), site diary, issues, defects and materials. Every word you type must match, in any order. Tapping a result opens that project on the right tab. Crew can search too, but only see what they already can. Money (expenses, payments, quotes) is not searched.

## Stage 4: works without signal

No migration needed.

- **Photos, new diary entries and checklist ticks/notes** made with no signal are saved on the phone and sent automatically when signal returns (on reconnect, when the app opens, and every 30 seconds). A bar at the top shows what is waiting; **Details** lists items with **Try again** / **Discard** for any the server refused.
- **My Day, projects, tasks, diary and checklists** can be read offline from the last copy the phone loaded. Your role is remembered, so manager screens still show.
- Each queued item has its own id, so a retry never creates duplicates.
- **Not offline:** other edits (task status, notes, editing existing entries), the photo gallery, and anything else needs signal.
- Signing out clears the cached copy but keeps unsent items. iOS can clear saved data if the phone is very low on space, so send soon after getting signal.

## Stage 5: variations

**Run `supabase/migration_28_variations.sql`** in the Supabase SQL editor (safe to run twice), then reload.

- Managers only: **Money → Variations** on each job. Crew never see it.
- Each variation gets a number per job (V1, V2…), what changed, a price (use a minus for a credit), details, and a status: Pending, Approved or Declined.
- Approving records who agreed and how (email, verbal, signed…) and the date.
- Totals show approved and still-waiting amounts. Delete has Undo.
- This stage only records. The status, approver and date fields are there so client approval through the client link can be added later.

## Stage 6: notifications

**Run `supabase/migration_29_notifications.sql`** (after 28), then reload. That alone gives you the in-app bell, mutes, settings and the 7am summary in the bell.

**What people are told about**
- Managers: task finished, task blocked, defect raised (urgent ones flagged), site issue, expense added, and a 7am summary (overdue tasks, deliveries due, materials not ordered for tasks starting soon, variations waiting too long, defects open too long).
- Crew: a task given to them, their task blocked or rescheduled, and a 7am summary of today's tasks.
- The person who did the thing is never told about it. Each person can switch any kind off, choose which ones also go to their phone, and mute a whole job (**Mute alerts** at the top of the job). Managers set the "too long" days (default 3 for variations, 7 for defects) in the bell's Settings tab.
- The summary goes out at 7am company time (`companies.timezone`, default `Australia/Melbourne`), once a day. It is scheduled with pg_cron. If the migration printed a notice that it could not schedule, enable **pg_cron** under Database > Extensions and run the migration again.

**Phone alerts and email (one-time setup, optional)**
1. Make push keys on your computer: `npx web-push generate-vapid-keys`.
2. Vercel: add `VITE_VAPID_PUBLIC_KEY` = the public key, then redeploy.
3. Supabase > Edge Functions: deploy `notify-deliver` (folder `supabase/functions/notify-deliver`), turn **off** "Verify JWT". Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@yourdomain.com`), `WEBHOOK_SECRET` (any long random text). For the email, also `RESEND_API_KEY` and `MAIL_FROM` (from resend.com, free tier is fine to start).
4. Supabase > Database > Webhooks > Create: table `notifications`, event **Insert**, type Supabase Edge Function > `notify-deliver`, add header `x-webhook-secret` with the same `WEBHOOK_SECRET`.
5. On each phone: iPhone needs the app added to the Home Screen first (iOS 16.4 or newer). Then bell > Settings > Send alerts to this phone.

Without steps 1 to 4 everything still works in the bell; the phone and email options just stay hidden.

Not included: payments overdue (there is no due date on payments yet) and client approvals (they come with the client link).
