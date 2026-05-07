-- GYMPODS OPS — Database Update v2
-- Run this in Supabase SQL Editor
-- This ADDS new columns to existing tables — safe to run on existing data

-- Add frequency scheduling to task library
ALTER TABLE task_library 
  ADD COLUMN IF NOT EXISTS frequency text default 'session' 
    check (frequency in ('session','daily','weekly','fortnightly','monthly','quarterly','yearly')),
  ADD COLUMN IF NOT EXISTS schedule_type text default 'any'
    check (schedule_type in ('any','specific_weekday','first_weekday_of_month','specific_date')),
  ADD COLUMN IF NOT EXISTS schedule_value integer, -- weekday 0-6, or date 1-31
  ADD COLUMN IF NOT EXISTS assigned_role text 
    check (assigned_role in ('foh','senior_foh','admin') or assigned_role is null);

-- Add geolocation to sites
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS geofence_radius integer default 200;

-- Add location tracking to completions
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS on_site boolean,
  ADD COLUMN IF NOT EXISTS comp_latitude numeric,
  ADD COLUMN IF NOT EXISTS comp_longitude numeric;

-- Update Dalston and Putney coordinates
-- Dalston Square, London E8 3FS
UPDATE sites SET 
  latitude = 51.5463, 
  longitude = -0.0756,
  geofence_radius = 200
WHERE name = 'GYMPODS Dalston';

-- Putney — update once you have the exact address coordinates
UPDATE sites SET 
  latitude = 51.4613, 
  longitude = -0.2156,
  geofence_radius = 200
WHERE name = 'GYMPODS Putney';
