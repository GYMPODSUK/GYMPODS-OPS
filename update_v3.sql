-- GYMPODS OPS — Database Update v3
-- Run in Supabase SQL Editor

-- Add day_type to shift_definitions
ALTER TABLE shift_definitions 
  ADD COLUMN IF NOT EXISTS day_type text default 'weekday'
    check (day_type in ('all', 'weekday', 'weekend'));

-- Update existing weekday shift times (both sites)
UPDATE shift_definitions SET day_type = 'weekday', start_time = '05:30', end_time = '12:00'
  WHERE name = 'Early Morning';

UPDATE shift_definitions SET day_type = 'weekday', start_time = '11:30', end_time = '17:00'
  WHERE name = 'Mid Shift';

UPDATE shift_definitions SET day_type = 'weekday', start_time = '16:00', end_time = '23:00'
  WHERE name = 'Evening';

UPDATE shift_definitions SET day_type = 'weekday', start_time = '21:00', end_time = '06:00'
  WHERE name = 'Overnight';

-- Add weekend shifts — Dalston
INSERT INTO shift_definitions (site_id, name, start_time, end_time, order_index, day_type) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Weekend Morning',   '08:00', '14:00', 5, 'weekend'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Weekend Afternoon', '13:00', '19:00', 6, 'weekend'),
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Weekend Overnight', '17:00', '08:00', 7, 'weekend')
ON CONFLICT DO NOTHING;

-- Add weekend shifts — Putney
INSERT INTO shift_definitions (site_id, name, start_time, end_time, order_index, day_type) VALUES
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Weekend Morning',   '08:00', '14:00', 5, 'weekend'),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Weekend Afternoon', '13:00', '19:00', 6, 'weekend'),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Weekend Overnight', '17:00', '08:00', 7, 'weekend')
ON CONFLICT DO NOTHING;
