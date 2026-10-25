-- ============================================================
-- Migration 8 (stage 4b-1): room sizes, door/window openings, expected delivery dates
-- Run once in the Supabase SQL editor, BEFORE deploying the matching app code.
-- Requires migrations 4 to 7 to have been run first.
-- Safe to re-run. Nothing is changed or deleted: existing rooms get empty sizes, and
-- existing measurements stay as ordinary "special measurements".
-- ============================================================

-- ---------- Room sizes ----------
-- Length, width and height are stored as typed, in the unit chosen for that room
-- (mm or m). Areas and wall sizes are worked out in the app, so editing a size updates
-- them everywhere. A room that is not a simple box can switch to typing the areas by hand.

alter table public.project_rooms
  add column if not exists room_length numeric(14, 4) check (room_length is null or room_length >= 0);
alter table public.project_rooms
  add column if not exists room_width numeric(14, 4) check (room_width is null or room_width >= 0);
alter table public.project_rooms
  add column if not exists room_height numeric(14, 4) check (room_height is null or room_height >= 0);
alter table public.project_rooms
  add column if not exists dim_unit text not null default 'mm' check (dim_unit in ('mm', 'm'));
alter table public.project_rooms
  add column if not exists manual_areas boolean not null default false;
-- Used only when manual_areas is on. Areas in m2, perimeter in m.
alter table public.project_rooms
  add column if not exists manual_floor_area numeric(14, 4) check (manual_floor_area is null or manual_floor_area >= 0);
alter table public.project_rooms
  add column if not exists manual_wall_area numeric(14, 4) check (manual_wall_area is null or manual_wall_area >= 0);
alter table public.project_rooms
  add column if not exists manual_perimeter numeric(14, 4) check (manual_perimeter is null or manual_perimeter >= 0);

-- ---------- Openings (doors, windows) ----------
-- An opening is a measurement flagged is_opening, with its width and height in the room's
-- unit. Its "value" holds the area in m2, which is what gets taken off the wall area.

alter table public.measurements
  add column if not exists is_opening boolean not null default false;
alter table public.measurements
  add column if not exists opening_width numeric(14, 4) check (opening_width is null or opening_width >= 0);
alter table public.measurements
  add column if not exists opening_height numeric(14, 4) check (opening_height is null or opening_height >= 0);

-- ---------- Expected delivery date for materials ----------
-- The ordered_on and delivered_on dates already exist (migration 7).

alter table public.task_materials
  add column if not exists expected_on date;
