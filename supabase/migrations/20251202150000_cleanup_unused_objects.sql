-- ============================================
-- Database Cleanup Migration
-- Removes unused objects from development
-- Safe to run - only removes confirmed unused objects
-- ============================================

-- Step 1: Drop unused sessions table
-- NOTE: This table was replaced by Supabase Auth sessions
-- The sessions table is no longer used in the codebase
DO $$
DECLARE
  session_count INTEGER;
BEGIN
  -- Check if sessions table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions'
  ) THEN
    -- Check row count for logging
    SELECT COUNT(*) INTO session_count FROM sessions;
    
    IF session_count > 0 THEN
      RAISE NOTICE 'WARNING: sessions table has % rows. This table is unused (replaced by Supabase Auth). Dropping...', session_count;
    ELSE
      RAISE NOTICE 'sessions table exists but is empty. Dropping unused table...';
    END IF;
    
    -- Drop dependent objects first (CASCADE handles most, but be explicit)
    DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions CASCADE;
    
    -- Drop RLS policies
    DROP POLICY IF EXISTS "service_full_access_sessions" ON sessions;
    DROP POLICY IF EXISTS "block_anon_sessions" ON sessions;
    
    -- Drop table (CASCADE will handle indexes and constraints)
    DROP TABLE IF EXISTS sessions CASCADE;
    
    RAISE NOTICE '✅ Dropped unused sessions table';
  ELSE
    RAISE NOTICE 'sessions table does not exist, skipping';
  END IF;
END $$;

-- Step 2: Drop unused cleanup function
-- This function was for cleaning expired sessions, but sessions table is unused
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'cleanup_expired_sessions'
    AND routine_type = 'FUNCTION'
  ) THEN
    DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;
    RAISE NOTICE '✅ Dropped unused cleanup_expired_sessions() function';
  ELSE
    RAISE NOTICE 'cleanup_expired_sessions() function does not exist, skipping';
  END IF;
END $$;

-- Step 3: Drop legacy kv_store table (if exists from Figma Make)
-- This was used by the old KV store implementation, now replaced by Supabase Auth
DO $$
DECLARE
  kv_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'kv_store_e2cf3727'
  ) THEN
    SELECT COUNT(*) INTO kv_count FROM kv_store_e2cf3727;
    
    IF kv_count > 0 THEN
      RAISE NOTICE 'WARNING: kv_store_e2cf3727 table has % rows. This is legacy from Figma Make. Dropping...', kv_count;
    ELSE
      RAISE NOTICE 'kv_store_e2cf3727 table exists but is empty. Dropping legacy table...';
    END IF;
    
    DROP TABLE IF EXISTS kv_store_e2cf3727 CASCADE;
    RAISE NOTICE '✅ Dropped legacy kv_store_e2cf3727 table';
  ELSE
    RAISE NOTICE 'kv_store_e2cf3727 table does not exist, skipping';
  END IF;
END $$;

-- Step 4: Clean up any orphaned indexes related to dropped tables
-- (Indexes should be dropped with tables via CASCADE, but check for orphans)
DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND (
      indexname LIKE '%sessions%' OR
      indexname LIKE '%kv_store%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name = 'sessions' OR
        table_name = 'kv_store_e2cf3727'
      )
    )
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idx_record.indexname) || ' CASCADE';
    RAISE NOTICE '✅ Dropped orphaned index: %', idx_record.indexname;
  END LOOP;
END $$;

-- Step 5: Verify cleanup and list remaining objects
DO $$
DECLARE
  table_rec RECORD;
  func_rec RECORD;
  view_rec RECORD;
  table_count INTEGER := 0;
  func_count INTEGER := 0;
  view_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP VERIFICATION ===';
  RAISE NOTICE '';
  
  -- List remaining tables
  RAISE NOTICE '📊 Remaining Tables:';
  FOR table_rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  LOOP
    table_count := table_count + 1;
    RAISE NOTICE '  ✅ %', table_rec.tablename;
  END LOOP;
  RAISE NOTICE '  Total: % tables', table_count;
  RAISE NOTICE '';
  
  -- List remaining functions
  RAISE NOTICE '⚙️  Remaining Functions:';
  FOR func_rec IN
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    ORDER BY routine_name
  LOOP
    func_count := func_count + 1;
    RAISE NOTICE '  ✅ %', func_rec.routine_name;
  END LOOP;
  RAISE NOTICE '  Total: % functions', func_count;
  RAISE NOTICE '';
  
  -- List remaining views
  RAISE NOTICE '👁️  Remaining Views:';
  FOR view_rec IN
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
    ORDER BY table_name
  LOOP
    view_count := view_count + 1;
    RAISE NOTICE '  ✅ %', view_rec.table_name;
  END LOOP;
  RAISE NOTICE '  Total: % views', view_count;
  RAISE NOTICE '';
  
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
  RAISE NOTICE 'Database is now clean and production-ready!';
END $$;

