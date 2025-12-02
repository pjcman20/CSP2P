# Immediate Actions to Reduce REST Requests

## 🚨 Critical: Do These First

### 1. Apply Database Migrations (CRITICAL)

**Why**: Views reduce queries from multiple to single. Without migrations, endpoints fall back to multiple queries.

```bash
# Apply migrations via Supabase Dashboard SQL Editor:
# 1. Run: supabase/migrations/20251202143158_database_organization.sql
# 2. Run: supabase/migrations/20251202144439_cleanup_unused_objects.sql

# OR via CLI:
supabase db push --project-ref fjouoltxkrdoxznodqzb
```

**Impact**: Reduces REST requests by **50-70%** (views replace multiple queries)

### 2. Set Production Environment Variables

```bash
# Set CORS origins (REQUIRED)
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com --project-ref fjouoltxkrdoxznodqzb

# Set environment flag
supabase secrets set ENVIRONMENT=production --project-ref fjouoltxkrdoxznodqzb

# Verify all secrets
supabase secrets list --project-ref fjouoltxkrdoxznodqzb
```

### 3. Deploy Updated Edge Function

```bash
# Deploy with caching and optimizations
supabase functions deploy make-server-e2cf3727 --project-ref fjouoltxkrdoxznodqzb
```

### 4. Restart Frontend Dev Server

The frontend changes (polling interval, user caching) require a restart:

```bash
# Stop current dev server (Ctrl+C)
# Then restart:
npm run dev
```

---

## 📊 Expected Results

### Before Fixes:
- REST Requests: 1,152+ /hour
- Polling: Every 3 seconds
- User fetches: Every component mount
- Database: Multiple queries per endpoint

### After Fixes:
- REST Requests: **< 100 /hour** (90% reduction)
- Polling: Every 30 seconds
- User fetches: Cached for 5 minutes
- Database: Single query per endpoint (views)

---

## 🔍 Verify Fixes Worked

### Check 1: Polling Interval
Open browser console, look for:
```
🔄 Setting up polling subscription for offers (every 30000 ms)...
```
Should say **30000** (not 3000)

### Check 2: User Caching
Open browser console, look for:
```
getCurrentUser: Returning cached user (saved REST request)
```
Should see this on subsequent calls

### Check 3: Cache Hits
Check Edge Function logs for:
```
✅ Cache hit: /offers/list (saved REST request)
💾 Cached /offers/list response (expires in 30s, X offers)
```

### Check 4: REST Request Count
Check Supabase Dashboard → API Usage → REST API Requests
Should see dramatic reduction after 1 hour

---

## 🎯 If REST Requests Still High

### Check These:

1. **Multiple Browser Tabs**: Each tab polls independently
   - Solution: Close extra tabs

2. **Database Views Not Applied**: Endpoints using fallback queries
   - Solution: Apply migrations immediately

3. **Auth Token Refresh**: Supabase auto-refreshing tokens
   - Solution: Already optimized (only refreshes when needed)

4. **Component Re-renders**: Components calling APIs on every render
   - Solution: Check useEffect dependencies

5. **Multiple Users**: If testing with multiple users
   - Solution: Normal (each user makes requests)

---

## 📝 Next Steps After Immediate Fixes

1. Monitor REST requests for 1 hour
2. If still high, check Edge Function logs for patterns
3. Consider implementing Supabase Realtime (eliminates polling)
4. Add request deduplication if needed
5. Set up monitoring/alerts

---

## ✅ Success Criteria

**Ready for Production When**:
- ✅ REST requests < 100/hour
- ✅ Migrations applied
- ✅ Environment variables set
- ✅ Edge Function deployed
- ✅ Frontend restarted
- ✅ All features working

