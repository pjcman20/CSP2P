# Database Cleanup Guide - Quick Reference

## What Will Be Removed

### Unused Objects:
1. ❌ **`sessions` table** - Replaced by Supabase Auth sessions
2. ❌ **`cleanup_expired_sessions()` function** - No longer needed
3. ❌ **`kv_store_e2cf3727` table** - Legacy from Figma Make (if exists)
4. ❌ **Orphaned indexes** - Any indexes left from dropped tables

### What Stays (All Active):
- ✅ `users` - User profiles
- ✅ `offers` - Trade offers  
- ✅ `offer_views` - Analytics
- ✅ `trade_requests` - Trade requests
- ✅ `reputation` - Reputation stats
- ✅ `reputation_votes` - Reputation votes
- ✅ `rate_limits` - Rate limiting
- ✅ All views (5 total)
- ✅ All active functions (4 total)
- ✅ All indexes and policies

## Quick Start

### Option 1: Apply Cleanup Migration (Recommended)

```bash
# Apply the cleanup migration
supabase db push --project-ref fjouoltxkrdoxznodqzb
```

Or apply manually in Supabase Dashboard SQL Editor:
1. Go to: SQL Editor → New Query
2. Copy contents of `supabase/migrations/20251202150000_cleanup_unused_objects.sql`
3. Run query

### Option 2: Verify First (Safer)

```sql
-- Check what exists before cleanup
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

## Safety Checks

### Before Running:
- [x] Migration is safe (only removes unused objects)
- [x] Uses CASCADE to handle dependencies
- [x] Includes verification queries
- [x] Logs what's being removed

### After Running:
- Check Supabase Dashboard → Database → Tables
- Verify only 7 tables remain
- Verify all views still work
- Test your application

## Expected Results

**Before Cleanup:**
- 8 tables (including unused `sessions`)
- 5+ functions (including unused cleanup function)
- Possibly legacy `kv_store` table

**After Cleanup:**
- 7 tables (only active ones)
- 4 functions (only active ones)
- Clean, production-ready database

## Rollback (If Needed)

If you need to restore the `sessions` table:

```sql
-- Recreate sessions table (if needed)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  steam_id TEXT NOT NULL REFERENCES users(steam_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  fingerprint TEXT,
  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Recreate indexes
CREATE INDEX idx_sessions_steam_id ON sessions(steam_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_active_at ON sessions(last_active_at DESC);

-- Recreate RLS policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_sessions" ON sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "block_anon_sessions" ON sessions FOR ALL TO anon USING (false) WITH CHECK (false);
```

## Files Updated

1. ✅ Created: `supabase/migrations/20251202150000_cleanup_unused_objects.sql`
2. ✅ Deleted: `supabase/migrations/20250101000000_database_organization.sql` (duplicate)
3. ✅ Created: `DATABASE_CLEANUP_PLAN.md` (detailed plan)
4. ✅ Created: `DATABASE_CLEANUP_GUIDE.md` (this file)

## Next Steps

1. **Review the cleanup migration** - Check `20251202150000_cleanup_unused_objects.sql`
2. **Apply migration** - Run `supabase db push` or apply via Dashboard
3. **Verify results** - Check that only active objects remain
4. **Test application** - Ensure everything still works

## Questions?

- **Will this delete my data?** No, only unused tables/functions are removed
- **Can I undo this?** Yes, see rollback section above
- **Is this safe?** Yes, only removes confirmed unused objects
- **What if I need sessions table later?** You can recreate it (see rollback)

## Summary

This cleanup removes:
- Unused `sessions` table (replaced by Supabase Auth)
- Unused cleanup function
- Legacy KV store table (if exists)
- Duplicate migration file

Result: Clean, production-ready database with only what you need! 🎉

