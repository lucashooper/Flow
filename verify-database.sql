-- Run this in Supabase SQL Editor to check what tables exist

SELECT 
  tablename,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- If you see folders, notes, dashboards, user_profiles, then tables exist
-- If you see nothing or only a few tables, the schema didn't run completely
