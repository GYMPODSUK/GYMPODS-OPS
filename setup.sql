-- GYMPODS OPS — Database Setup
-- Run this entire script in Supabase SQL Editor
-- Project: GYMPODS OPS

-- ─── TABLES ────────────────────────────────────────────────────────────────

create table if not exists sites (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists staff (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references sites(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  pin text not null,
  role text not null check (role in ('foh', 'senior_foh', 'admin', 'hq')),
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists task_library (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references sites(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('cleaning', 'health_safety', 'maintenance', 'opening_closing', 'other')),
  is_global boolean default false,
  created_at timestamptz default now()
);

create table if not exists shift_definitions (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references sites(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  order_index integer not null,
  created_at timestamptz default now()
);

create table if not exists shift_tasks (
  id uuid default gen_random_uuid() primary key,
  shift_id uuid references shift_definitions(id) on delete cascade,
  task_id uuid references task_library(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz default now(),
  unique(shift_id, task_id)
);

create table if not exists task_completions (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references sites(id) on delete cascade,
  shift_id uuid references shift_definitions(id) on delete cascade,
  task_id uuid references task_library(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('completed', 'flagged')),
  comment text,
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists issues (
  id uuid default gen_random_uuid() primary key,
  task_completion_id uuid references task_completions(id) on delete cascade,
  site_id uuid references sites(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  task_name text,
  description text,
  status text default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_by uuid references staff(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists issue_images (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references issues(id) on delete cascade,
  image_url text not null,
  created_at timestamptz default now()
);

-- ─── DISABLE RLS FOR PHASE 1 ───────────────────────────────────────────────
-- We use PIN-based auth managed by the app, not Supabase Auth
-- RLS can be enabled and hardened in Phase 2

alter table sites disable row level security;
alter table staff disable row level security;
alter table task_library disable row level security;
alter table shift_definitions disable row level security;
alter table shift_tasks disable row level security;
alter table task_completions disable row level security;
alter table issues disable row level security;
alter table issue_images disable row level security;

-- ─── STORAGE BUCKET ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('issue-images', 'issue-images', true)
on conflict (id) do nothing;

-- Allow all operations on storage for Phase 1
create policy "Public issue images" on storage.objects
  for all using (bucket_id = 'issue-images')
  with check (bucket_id = 'issue-images');

-- ─── SEED DATA ─────────────────────────────────────────────────────────────

-- Sites
insert into sites (id, name, address) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'GYMPODS Dalston', 'Dekker House, Dalston Square, London E8 3FS'),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'GYMPODS Putney', 'Putney, London')
on conflict do nothing;

-- Staff seed accounts
-- IMPORTANT: Change these PINs after first login
-- Admin Dalston: PIN 1234
-- Admin Putney:  PIN 5678
-- HQ Access:     PIN 9999
insert into staff (site_id, first_name, last_name, pin, role) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Admin', 'Dalston', '1234', 'admin'),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Admin', 'Putney', '5678', 'admin'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'HQ', 'Admin', '9999', 'hq')
on conflict do nothing;

-- Shift definitions — Dalston
insert into shift_definitions (site_id, name, start_time, end_time, order_index) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Early Morning', '06:00', '10:00', 1),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Mid Shift',     '10:00', '15:00', 2),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Evening',       '15:00', '21:00', 3),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Overnight',     '21:00', '06:00', 4)
on conflict do nothing;

-- Shift definitions — Putney
insert into shift_definitions (site_id, name, start_time, end_time, order_index) values
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Early Morning', '06:00', '10:00', 1),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Mid Shift',     '10:00', '15:00', 2),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Evening',       '15:00', '21:00', 3),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Overnight',     '21:00', '06:00', 4)
on conflict do nothing;

-- Global task library (available to all sites)
insert into task_library (name, category, description, is_global, site_id) values
  -- Opening & Closing
  ('Disarm alarm and complete opening procedure', 'opening_closing', 'Disarm intruder alarm, complete full opening checklist', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Switch on all equipment and screens', 'opening_closing', 'Echelon, Peloton, StairMaster, Reflect screens, music system', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check all PODs clean and reset', 'opening_closing', 'Check every POD is tidy and equipment correctly positioned', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Complete closing procedure and arm alarm', 'opening_closing', 'Full closing checklist, switch off all equipment, arm alarm', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Final walk-through all areas', 'opening_closing', 'Check all PODs, corridor, toilets, reception before close', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  -- Cleaning
  ('Sanitise POD equipment after session', 'cleaning', 'BLUE microfibre cloth and antibacterial spray on all touched surfaces after every client session', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Clean mirrors and screens', 'cleaning', 'YELLOW/GREEN microfibre cloth only on all mirrors and cardio screens', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Empty bins — all PODs, shower, toilet', 'cleaning', 'Empty and reline all bins before end of shift', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Clean shower — spray and hose down', 'cleaning', 'Daily shower spray inside door, hose down tray after each use', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Clean reception and coffee machine', 'cleaning', 'Wipe desktop, shelving, fridges, coffee machine and floor', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Hoover main floor all PODs', 'cleaning', 'Hoover entire floor area of all PODs and corridor', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Deep clean — see schedule', 'cleaning', 'Check weekly deep clean schedule for today''s assigned POD or area', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  -- Health & Safety
  ('Visual equipment check — all areas', 'health_safety', 'Check all equipment daily for damage, faults or safety concerns. Photograph and report issues immediately.', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check fire alarm panel', 'health_safety', 'Panel located at reception — confirm no faults showing', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check emergency exits are clear', 'health_safety', 'Main entrance and fire exit corridor must be unobstructed', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check first aid kit', 'health_safety', 'Confirm kit is stocked and accessible. Report any items needing replacement.', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Treadmill safety cord check', 'health_safety', 'Confirm red safety cord is correctly inserted before opening', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check dual assisted pulley operation', 'health_safety', 'Test smooth operation of cable and pulley system — report any stiffness or resistance', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  -- Maintenance
  ('Lubricate cable posts and weight guide rods', 'maintenance', 'Apply lubricant and move cable attachment full range to ensure smooth movement. Weekly minimum.', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Reformer Machine lubrication', 'maintenance', 'Lubricate Reformer Machine — monthly. Log date in diary.', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Check and top up cleaning supplies', 'maintenance', 'Antibacterial spray, microfibre cloths, bin liners, toilet roll, soap, daily shower spray', true, 'a1b2c3d4-0001-0001-0001-000000000001'),
  ('Date check fridge products and bars', 'maintenance', 'Check all fridge products and snack bars for expiry dates', true, 'a1b2c3d4-0001-0001-0001-000000000001')
on conflict do nothing;
