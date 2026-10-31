-- ============================================================
-- Migration 13 (stage A): actual project dates + quote set-up
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 12 to have been run first.
-- Safe to re-run. No existing figure is changed.
-- ============================================================

-- Actual start / end of the whole project (the existing start_date / end_date are the PLANNED dates).
alter table public.projects add column if not exists actual_start date;
alter table public.projects add column if not exists actual_end date;

-- Quote set-up (admin only, same table and RLS as budget / markup).
--   quote_mode 'buildup': estimates + markup give the quote price.
--   quote_mode 'lump'   : quote_lump is typed in directly (quick quote).
-- The existing "budget" column keeps holding the target cost (sum of the estimates in build-up mode).
-- The old gst_enabled column stays but is no longer used: every amount is now entered as paid / received.
alter table public.project_finance add column if not exists quote_mode text not null default 'buildup';
alter table public.project_finance add column if not exists quote_lump numeric(12, 2);
alter table public.project_finance add column if not exists est_materials numeric(12, 2);
alter table public.project_finance add column if not exists est_equipment numeric(12, 2);
alter table public.project_finance add column if not exists est_labour numeric(12, 2);
alter table public.project_finance add column if not exists est_subcontractors numeric(12, 2);
alter table public.project_finance add column if not exists est_other numeric(12, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_finance_quote_mode_check') then
    alter table public.project_finance
      add constraint project_finance_quote_mode_check check (quote_mode in ('buildup', 'lump'));
  end if;
end $$;
