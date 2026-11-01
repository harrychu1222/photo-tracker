-- Migration 15: where a material was ordered from, and which level a room is on.
-- Safe to run more than once.

alter table public.task_materials add column if not exists supplier text;
alter table public.project_rooms add column if not exists level text;
