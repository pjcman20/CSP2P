# Database Cleanup Plan - Remove Unused Objects

## Current Database Objects

### Tables (8 total)
1. ✅ **users** - ACTIVE (used)
2. ❌ **sessions** - UNUSED (replaced by Supabase Auth sessions)
3. ✅ **offers** - ACTIVE (used)
4. ✅ **offer_views** - ACTIVE (used)
5. ✅ **trade_requests** - ACTIVE (used)
6. ✅ **reputation** - ACTIVE (used)
7. ✅ **reputation_votes** - ACTIVE (used)
8. ✅ **rate_limits** - ACTIVE (used)

### Views (5 total)
1. ✅ **active_offers_with_users** - ACTIVE (from initial schema)
2. ✅ **user_statistics** - ACTIVE (from initial schema)
3. ✅ **user_activity_summary** - ACTIVE (from organization migration)
4. ✅ **user_offers_detailed** - ACTIVE (from organization migration)
5. ✅ **user_trade_requests_detailed** - ACTIVE (from organization migration)

### Functions (4 total)
1. ✅ **update_updated_at_column()** - ACTIVE (trigger function)
2. ✅ **increment_offer_views()** - ACTIVE (trigger function)
3. ✅ **update_reputation_stats()** - ACTIVE (trigger function)
4. ✅ **get_user_complete_data()** - ACTIVE (helper function)
5. ✅ **cleanup_expired_sessions()** - UNUSED (sessions table not used)
6. ✅ **cleanup_expired_rate_limits()** - ACTIVE (used in Edge Function)

### Potential Unused Objects
- ❌ **sessions** table - Not used (Supabase Auth handles sessions)
- ❌ **cleanup_expired_sessions()** function - Not needed
- ❌ **kv_store_e2cf3727** table - May exist from Figma Make (check if exists)
- ❌ Duplicate migration file - `20250101000000_database_organization.sql` (duplicate)

## Cleanup Strategy

### Option 1: Safe Cleanup (Recommended)
Remove only confirmed unused objects while keeping everything else.

### Option 2: Full Reset
Drop and recreate everything from migrations (loses all data).

### Option 3: Selective Cleanup
Remove unused objects and consolidate migrations.

## Recommended Approach: Option 1 (Safe Cleanup)

### Step 1: Identify Unused Objects

**Unused Tables:**
- `sessions` - Replaced by Supabase Auth sessions
- `kv_store_e2cf3727` - Legacy from Figma Make (if exists)

**Unused Functions:**
- `cleanup_expired_sessions()` - No longer needed

**Unused Migrations:**
- `20250101000000_database_organization.sql` - Duplicate file

### Step 2: Create Cleanup Migration

Create a migration that:
1. Drops unused `sessions` table (if empty or after data backup)
2. Drops unused `cleanup_expired_sessions()` function
3. Drops `kv_store_e2cf3727` table if it exists
4. Removes duplicate migration file

### Step 3: Verify Dependencies

Before dropping, check:
- No foreign keys referencing `sessions` table
- No code references to `sessions` table
- No triggers on `sessions` table

## Cleanup Migration Script

```sql
-- ============================================
-- Database Cleanup Migration
-- Removes unused objects from development
-- ============================================

-- Step 1: Drop unused sessions table
-- NOTE: This table was replaced by Supabase Auth sessions
-- Check if table has data first, backup if needed
DO $$
BEGIN
  -- Check if sessions table exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions'
  ) THEN
    -- Check row count
    IF (SELECT COUNT(*) FROM sessions) > 0 THEN
      RAISE NOTICE 'WARNING: sessions table has % rows. Consider backing up before dropping.', 
        (SELECT COUNT(*) FROM sessions);
    END IF;
    
    -- Drop dependent objects first
    DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions CASCADE;
    DROP INDEX IF EXISTS idx_sessions_steam_id CASCADE;
    DROP INDEX IF EXISTS idx_sessions_expires_at CASCADE;
    DROP INDEX IF EXISTS idx_sessions_last_active_at CASCADE;
    
    -- Drop RLS policies
    DROP POLICY IF EXISTS "service_full_access_sessions" ON sessions;
    DROP POLICY IF EXISTS "block_anon_sessions" ON sessions;
    
    -- Drop table
    DROP TABLE IF EXISTS sessions CASCADE;
    
    RAISE NOTICE 'Dropped unused sessions table';
  ELSE
    RAISE NOTICE 'sessions table does not exist, skipping';
  END IF;
END $$;

-- Step 2: Drop unused cleanup function
DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;

-- Step 3: Drop legacy kv_store table (if exists from Figma Make)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'kv_store_e2cf3727'
  ) THEN
    DROP TABLE IF EXISTS kv_store_e2cf3727 CASCADE;
    RAISE NOTICE 'Dropped legacy kv_store_e2cf3727 table';
  ELSE
    RAISE NOTICE 'kv_store_e2cf3727 table does not exist, skipping';
  END IF;
END $$;

-- Step 4: Clean up any orphaned indexes
-- (Indexes should be dropped with tables, but check for orphans)
DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE '%sessions%'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = split_part(indexname, '_', 2)
    )
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(idx_record.indexname) || ' CASCADE';
    RAISE NOTICE 'Dropped orphaned index: %', idx_record.indexname;
  END LOOP;
END $$;

-- Step 5: Verify cleanup
DO $$
BEGIN
  RAISE NOTICE '=== CLEANUP VERIFICATION ===';
  RAISE NOTICE 'Remaining tables:';
  FOR rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  LOOP
    RAISE NOTICE '  - %', rec.tablename;
  END LOOP;
  
  RAISE NOTICE 'Remaining functions:';
  FOR rec IN
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    ORDER BY routine_name
  LOOP
    RAISE NOTICE '  - %', rec.routine_name;
  END LOOP;
END $$;
```

## Files to Clean Up

### 1. Remove Duplicate Migration File
- Delete: `supabase/migrations/20250101000000_database_organization.sql`
- Keep: `supabase/migrations/20251202143158_database_organization.sql`

### 2. Update Initial Schema (Optional)
- Remove `sessions` table definition from initial schema
- Remove `cleanup_expired_sessions()` function
- Note: Only if you want to clean up migration history (not recommended if already applied)

## Before Running Cleanup

### 1. Backup Data (if needed)
```sql
-- Backup sessions table if it has data you want to keep
CREATE TABLE sessions_backup AS SELECT * FROM sessions;
```

### 2. Check for Dependencies
```sql
-- Check for foreign keys referencing sessions
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name = 'sessions';
```

### 3. Verify Unused Objects
```sql
-- Check if sessions table is referenced anywhere
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'sessions';

-- Check for triggers
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'sessions';
```

## Execution Steps

### Step 1: Review Current State
```bash
# Connect to Supabase database
supabase db connect --project-ref fjouoltxkrdoxznodqzb

# Or use Supabase Dashboard SQL Editor
```

### Step 2: Run Verification Queries
Run the verification queries above to confirm what exists.

### Step 3: Create Cleanup Migration
```bash
# Create new migration file
supabase migration new cleanup_unused_objects
```

### Step 4: Apply Cleanup Migration
```bash
# Apply migration
supabase db push --project-ref fjouoltxkrdoxznodqzb
```

### Step 5: Remove Duplicate Files
```bash
# Remove duplicate migration file
rm supabase/migrations/20250101000000_database_organization.sql
```

## Expected Results

### After Cleanup:
- ✅ Only 7 tables remain (users, offers, offer_views, trade_requests, reputation, reputation_votes, rate_limits)
- ✅ Only active functions remain
- ✅ No duplicate migrations
- ✅ Clean, production-ready database

### Tables Remaining:
1. `users` - User profiles
2. `offers` - Trade offers
3. `offer_views` - Analytics
4. `trade_requests` - Trade requests
5. `reputation` - Reputation stats
6. `reputation_votes` - Reputation votes
7. `rate_limits` - Rate limiting

### Views Remaining:
1. `active_offers_with_users`
2. `user_statistics`
3. `user_activity_summary`
4. `user_offers_detailed`
5. `user_trade_requests_detailed`

## Safety Checklist

Before running cleanup:
- [ ] Backup database (Supabase Dashboard → Database → Backups)
- [ ] Verify `sessions` table is not used in code
- [ ] Check if `sessions` table has important data
- [ ] Verify no foreign keys depend on `sessions`
- [ ] Test cleanup in staging/dev first
- [ ] Document what will be removed

## Alternative: Keep Sessions Table

If you want to keep `sessions` table for future use:
- Comment out the DROP TABLE statement
- Keep the table but mark it as unused
- Can be used later for session audit logging

## Post-Cleanup Verification

After cleanup, verify:
```sql
-- Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check views
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' ORDER BY table_name;
```

## Summary

**Objects to Remove:**
- ❌ `sessions` table (unused)
- ❌ `cleanup_expired_sessions()` function (unused)
- ❌ `kv_store_e2cf3727` table (if exists, legacy)
- ❌ Duplicate migration file

**Objects to Keep:**
- ✅ All 7 active tables
- ✅ All 5 views
- ✅ All active functions
- ✅ All indexes and policies

This cleanup will result in a clean, production-ready database with only what's needed.

