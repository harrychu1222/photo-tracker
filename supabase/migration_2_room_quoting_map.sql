-- ============================================================
-- Migration 2: room, quoting status, map coordinates
-- Run this once in the Supabase SQL editor. Safe to run even if you
-- already have data — it only adds columns, nothing is dropped.
-- ============================================================

alter table public.photos add column if not exists room text not null default '';
alter table public.photos add column if not exists quoting_status text; -- null | 'pending_quotation' | 'quoted' | 'rejected'
alter table public.photos add column if not exists lat double precision;
alter table public.photos add column if not exists lng double precision;
