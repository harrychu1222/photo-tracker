-- Stage F1: business details for the quote PDF and the payment schedule.

-- One row of business details (name, ABN, phone ... and standard terms) for quote PDFs.
create table if not exists public.business_profile (
  singleton boolean primary key default true check (singleton),
  name text,
  abn text,
  phone text,
  email text,
  address text,
  terms text,
  valid_days int not null default 30 check (valid_days between 1 and 365),
  updated_at timestamptz not null default now()
);
alter table public.business_profile enable row level security;
drop policy if exists "business readable" on public.business_profile;
create policy "business readable" on public.business_profile for select to authenticated using (true);
drop policy if exists "admins add business" on public.business_profile;
create policy "admins add business" on public.business_profile for insert to authenticated with check (public.is_admin());
drop policy if exists "admins change business" on public.business_profile;
create policy "admins change business" on public.business_profile for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Payment schedule: the payments the client agreed to make. Admin only (like payments).
create table if not exists public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_on date,
  payment_id uuid references public.payments(id) on delete set null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists payment_milestones_project_idx on public.payment_milestones (project_id);
alter table public.payment_milestones enable row level security;
drop policy if exists "admins see milestones" on public.payment_milestones;
create policy "admins see milestones" on public.payment_milestones for select to authenticated using (public.is_admin());
drop policy if exists "admins add milestones" on public.payment_milestones;
create policy "admins add milestones" on public.payment_milestones for insert to authenticated with check (public.is_admin());
drop policy if exists "admins change milestones" on public.payment_milestones;
create policy "admins change milestones" on public.payment_milestones for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete milestones" on public.payment_milestones;
create policy "admins delete milestones" on public.payment_milestones for delete to authenticated using (public.is_admin());
