-- Stage F2: assign a task to a person who has a login (feeds "My Day").
alter table public.tasks add column if not exists assigned_user uuid references auth.users(id) on delete set null;
create index if not exists tasks_assigned_user_idx on public.tasks (assigned_user);

-- Quote wording the builder edits per project (lines, notes, price label, GST line). Admin only.
create table if not exists public.project_quotes (
  project_id uuid primary key references public.projects(id) on delete cascade,
  lines jsonb not null default '[]'::jsonb,
  notes text,
  price_label text,
  gst_note text,
  updated_at timestamptz not null default now()
);
alter table public.project_quotes enable row level security;
drop policy if exists "admins see quote wording" on public.project_quotes;
create policy "admins see quote wording" on public.project_quotes for select to authenticated using (public.is_admin());
drop policy if exists "admins add quote wording" on public.project_quotes;
create policy "admins add quote wording" on public.project_quotes for insert to authenticated with check (public.is_admin());
drop policy if exists "admins change quote wording" on public.project_quotes;
create policy "admins change quote wording" on public.project_quotes for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete quote wording" on public.project_quotes;
create policy "admins delete quote wording" on public.project_quotes for delete to authenticated using (public.is_admin());
