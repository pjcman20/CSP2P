# Production Readiness Checklist

## 🚨 Critical Issues to Fix Before Production

### 1. REST Requests Still High ⚠️ CRITICAL

**Current Issue**: REST requests remain high despite polling fix

**Additional Sources to Check**:
- [ ] **Auth token refresh** - Supabase auto-refreshes tokens (may cause REST requests)
- [ ] **Multiple components fetching** - Check if multiple components call same endpoints
- [ ] **useEffect dependencies** - Components re-fetching on every render
- [ ] **getCurrentUser() calls** - May be called repeatedly

**Immediate Actions**:
1. **Disable auto token refresh** (if not needed):
   ```typescript
   // In supabaseClient.ts
   auth: {
     autoRefreshToken: false, // Disable if causing too many requests
   }
   ```

2. **Add request deduplication** - Prevent multiple simultaneous requests
3. **Cache user data** - Don't refetch user on every component mount
4. **Reduce auth checks** - Only check auth when needed, not on every render

### 2. Apply Database Migrations ⚠️ CRITICAL

**Status**: Migrations created but not applied

**Required Actions**:
```bash
# Apply all migrations
supabase db push --project-ref fjouoltxkrdoxznodqzb

# Or apply manually in Supabase Dashboard SQL Editor:
# 1. 20251202143158_database_organization.sql
# 2. 20251202144439_cleanup_unused_objects.sql
```

**Why Critical**: Views won't work without migrations, causing fallback queries (more REST requests)

### 3. Set Production Environment Variables ⚠️ CRITICAL

**Required Edge Function Secrets**:
```bash
# Set CORS origins (REQUIRED for production)
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com --project-ref fjouoltxkrdoxznodqzb

# Set environment flag
supabase secrets set ENVIRONMENT=production --project-ref fjouoltxkrdoxznodqzb

# Verify all required secrets are set
supabase secrets list --project-ref fjouoltxkrdoxznodqzb
```

**Required Secrets**:
- ✅ `SUPABASE_URL` (should already be set)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (should already be set)
- ✅ `STEAM_API_KEY` (should already be set)
- ✅ `ANON_KEY` (should already be set)
- ⚠️ `ALLOWED_ORIGINS` (NEW - required for production)
- ⚠️ `ENVIRONMENT` (NEW - set to "production")

---

## 📋 Complete Production Readiness Checklist

### Phase 1: Critical Fixes (Do First)

#### REST Requests Optimization
- [ ] **Fix 1**: Increase polling interval to 30s ✅ (Done)
- [ ] **Fix 2**: Add response caching ✅ (Done)
- [ ] **Fix 3**: Disable auto token refresh (if causing issues)
- [ ] **Fix 4**: Add request deduplication
- [ ] **Fix 5**: Cache user data in frontend
- [ ] **Fix 6**: Reduce auth checks (only when needed)
- [ ] **Fix 7**: Apply database migrations (views reduce queries)
- [ ] **Fix 8**: Monitor REST requests after fixes

#### Database
- [ ] Apply `20251202143158_database_organization.sql` migration
- [ ] Apply `20251202144439_cleanup_unused_objects.sql` migration
- [ ] Verify views are created and working
- [ ] Verify indexes are created
- [ ] Test helper function `get_user_complete_data()`

#### Security
- [ ] Set `ALLOWED_ORIGINS` environment variable
- [ ] Set `ENVIRONMENT=production` variable
- [ ] Test CORS with unauthorized origin (should fail)
- [ ] Verify error messages don't leak details
- [ ] Verify security headers are present
- [ ] Test rate limiting works

### Phase 2: Configuration & Deployment

#### Environment Variables
- [ ] **Frontend** (`.env.production`):
  ```env
  VITE_SUPABASE_PROJECT_ID=fjouoltxkrdoxznodqzb
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

- [ ] **Edge Function Secrets** (via Supabase CLI or Dashboard):
  ```bash
  SUPABASE_URL=https://fjouoltxkrdoxzb.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-key
  STEAM_API_KEY=your-steam-key
  ANON_KEY=your-anon-key
  ALLOWED_ORIGINS=https://your-domain.com
  ENVIRONMENT=production
  ```

#### Database
- [ ] All migrations applied
- [ ] Views created and tested
- [ ] Indexes created
- [ ] RLS policies verified
- [ ] Cleanup migration applied (removed unused objects)

#### Edge Functions
- [ ] Deploy latest Edge Function:
  ```bash
  supabase functions deploy make-server-e2cf3727 --project-ref fjouoltxkrdoxznodqzb
  ```
- [ ] Verify function is running
- [ ] Test health endpoint
- [ ] Check logs for errors

### Phase 3: Performance Optimization

#### REST Requests
- [ ] Monitor REST request count (should be < 100/hour)
- [ ] Identify any remaining high-frequency endpoints
- [ ] Add caching for frequently accessed data
- [ ] Consider Supabase Realtime instead of polling

#### Frontend Optimization
- [ ] Remove console.log statements (or use env check)
- [ ] Optimize bundle size
- [ ] Add loading states
- [ ] Implement error boundaries
- [ ] Add request deduplication

#### Database Optimization
- [ ] Verify views are being used (check query plans)
- [ ] Monitor slow queries
- [ ] Optimize indexes if needed
- [ ] Set up query performance monitoring

### Phase 4: Testing & Verification

#### Functional Testing
- [ ] Test Steam login flow end-to-end
- [ ] Test offer creation
- [ ] Test offer viewing
- [ ] Test trade requests
- [ ] Test reputation voting
- [ ] Test user profile updates

#### Security Testing
- [ ] Test CORS with unauthorized origin
- [ ] Test error responses (should not leak details)
- [ ] Test rate limiting
- [ ] Test authentication on protected endpoints
- [ ] Verify no service role key in frontend

#### Performance Testing
- [ ] Test with 100+ offers
- [ ] Test with multiple concurrent users
- [ ] Monitor REST request count
- [ ] Check response times (< 500ms)
- [ ] Verify caching works

### Phase 5: Monitoring & Maintenance

#### Monitoring Setup
- [ ] Set up Supabase Dashboard monitoring
- [ ] Monitor Edge Function logs
- [ ] Track REST request count
- [ ] Monitor error rates
- [ ] Set up alerts for high error rates

#### Documentation
- [ ] Document deployment process
- [ ] Document environment variables
- [ ] Document database schema
- [ ] Create runbook for common issues
- [ ] Document rollback procedures

---

## 🔍 Debugging High REST Requests

### Check These Sources:

1. **Frontend Polling**:
   - Check browser console for polling logs
   - Verify interval is 30 seconds (not 3)
   - Check if multiple components are polling

2. **Auth Token Refresh**:
   - Check Supabase client config
   - May be auto-refreshing tokens frequently
   - Consider disabling if not needed

3. **Component Re-renders**:
   - Check useEffect dependencies
   - May be causing repeated API calls
   - Add proper dependency arrays

4. **Multiple API Calls**:
   - Check if same endpoint called multiple times
   - Add request deduplication
   - Use React Query or SWR for caching

5. **Database Views Not Applied**:
   - If views don't exist, endpoints fall back to multiple queries
   - Apply migrations immediately

### Quick Diagnostic:

```typescript
// Add to frontend to track API calls
let apiCallCount = 0;
const originalFetch = window.fetch;
window.fetch = (...args) => {
  apiCallCount++;
  console.log(`API Call #${apiCallCount}:`, args[0]);
  return originalFetch(...args);
};
```

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations
```bash
# Option A: Via CLI
supabase db push --project-ref fjouoltxkrdoxznodqzb

# Option B: Via Dashboard
# Go to SQL Editor → Run migration files manually
```

### Step 2: Set Environment Variables
```bash
# Set production environment variables
supabase secrets set \
  ALLOWED_ORIGINS=https://your-domain.com \
  ENVIRONMENT=production \
  --project-ref fjouoltxkrdoxznodqzb
```

### Step 3: Deploy Edge Function
```bash
supabase functions deploy make-server-e2cf3727 --project-ref fjouoltxkrdoxznodqzb
```

### Step 4: Build & Deploy Frontend
```bash
# Build for production
npm run build

# Deploy to your hosting (Vercel, Netlify, etc.)
# Make sure to set environment variables in hosting platform
```

### Step 5: Verify Deployment
- [ ] Test health endpoint
- [ ] Test Steam login
- [ ] Test all major features
- [ ] Monitor REST requests
- [ ] Check error logs

---

## 📊 Expected Metrics After Fixes

### REST Requests:
- **Before**: 1,152+ requests/hour
- **Target**: < 100 requests/hour
- **With caching**: < 20 requests/hour

### Response Times:
- **Target**: < 500ms for all endpoints
- **Cached responses**: < 50ms

### Error Rate:
- **Target**: < 1% error rate
- **Monitor**: 500 errors, auth failures

---

## 🎯 Priority Order

### Must Do Before Production:
1. ✅ Apply database migrations (views reduce queries)
2. ✅ Set `ALLOWED_ORIGINS` environment variable
3. ✅ Set `ENVIRONMENT=production` variable
4. ✅ Deploy updated Edge Function
5. ✅ Monitor REST requests after deployment

### Should Do Soon:
6. Add request deduplication
7. Cache user data in frontend
8. Reduce auth checks
9. Set up monitoring/alerts
10. Document deployment process

### Nice to Have:
11. Implement Supabase Realtime
12. Add React Query for caching
13. Optimize bundle size
14. Add error boundaries
15. Set up CI/CD pipeline

---

## 🔧 Quick Fixes for REST Requests

### Fix 1: Disable Auto Token Refresh (If Causing Issues)
```typescript
// src/utils/supabaseClient.ts
export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  auth: {
    autoRefreshToken: false, // Disable if causing too many requests
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

### Fix 2: Cache User Data
```typescript
// Add user cache to prevent repeated calls
let cachedUser: SteamUser | null = null;
let cacheExpiry = 0;

export async function getCurrentUser(): Promise<SteamUser | null> {
  // Return cached user if still valid (5 minutes)
  if (cachedUser && Date.now() < cacheExpiry) {
    return cachedUser;
  }
  
  // Fetch user...
  cachedUser = user;
  cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
  return user;
}
```

### Fix 3: Reduce Auth Checks
```typescript
// Only check auth when actually needed, not on every render
// Remove unnecessary getCurrentUser() calls
```

---

## ✅ Success Criteria

**Production Ready When**:
- ✅ REST requests < 100/hour
- ✅ All migrations applied
- ✅ Environment variables set
- ✅ CORS configured
- ✅ Security headers present
- ✅ Error handling working
- ✅ All features tested
- ✅ Monitoring set up

**Deploy When**:
- ✅ All critical items checked
- ✅ REST requests under control
- ✅ No critical errors
- ✅ Performance acceptable
- ✅ Security verified

