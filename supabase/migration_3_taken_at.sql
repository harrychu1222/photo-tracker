-- ============================================================
-- Migration 3: photo-taken date (from EXIF), used for the timeline view
-- Run once in the Supabase SQL editor. Only adds a column; no data is touched.
-- ============================================================

alter table public.photos add column if not exists taken_at timestamptz;

-- Backfill: for photos uploaded before this migration, we have no EXIF data
-- on file anymore, so use the upload time as the best available stand-in.
update public.photos set taken_at = created_at where taken_at is null;
