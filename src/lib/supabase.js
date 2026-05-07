import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sdfoakmwefirdcwugqqc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkZm9ha213ZWZpcmRjd3VncXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTY1NDgsImV4cCI6MjA5MzY5MjU0OH0.KBOJjWRFs9A2OMXLv0CYW5JFSPwBrVrYSyWOGaeyOnM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
