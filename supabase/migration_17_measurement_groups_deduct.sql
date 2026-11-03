-- Stage D: named groups of special measurements (e.g. Vanity: width, height off floor)
-- and a per-opening choice whether it is taken off the wall area.
alter table public.measurements add column if not exists group_name text;
alter table public.measurements add column if not exists deduct boolean not null default true;
