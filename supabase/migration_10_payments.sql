-- ============================================================
-- Migration 10 (stage 4c): payments received from the client
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 9 to have been run first.
-- Safe to re-run. Nothing existing is changed.
-- ============================================================

-- Money received for a project (deposit, progress claim, final payment...).
-- Stored ex-GST like expenses (the app converts an amount that includes GST before saving).
-- Admin only: crew cannot see or add payments.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  received_on date not null default current_date,
  description text not null default 'Payment' check (length(trim(description)) > 0),
  amount_ex_gst numeric(12, 2) not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_project_id_idx on public.payments (project_id);
create index if not exists payments_date_idx on public.payments (received_on);

alter table public.payments enable row level security;

drop policy if exists "admins see payments" on public.payments;
create policy "admins see payments"
  on public.payments for select to authenticated using (public.is_admin());

drop policy if exists "admins add payments" on public.payments;
create policy "admins add payments"
  on public.payments for insert to authenticated
  with check (public.is_admin() and auth.uid() = created_by);

drop policy if exists "admins change payments" on public.payments;
create policy "admins change payments"
  on public.payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete payments" on public.payments;
create policy "admins delete payments"
  on public.payments for delete to authenticated using (public.is_admin());
