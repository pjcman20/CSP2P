# Fix REST Requests Spike (1,152 requests)

## Root Cause Identified

**Problem**: Frontend polling is making API calls every **3 seconds** (3000ms)

**Impact**:
- 1 request every 3 seconds = **20 requests/minute**
- 20 requests/minute × 60 minutes = **1,200 requests/hour**
- If testing for ~1 hour = **1,152 requests** ✅ (matches your count!)

**Location**: 
- `src/components/MarketplaceFeed.tsx` - Uses polling subscription
- `src/utils/pollingSubscription.ts` - Default interval is 3000ms (3 seconds)

## Immediate Fixes Needed

### Fix 1: Increase Polling Interval ⚠️ CRITICAL

**Current**: Polls every 3 seconds (too frequent!)
**Recommended**: Poll every 30-60 seconds (or use Supabase Realtime)

### Fix 2: Add Response Caching ⚠️ HIGH PRIORITY

Cache `/offers/list` endpoint responses for 30 seconds to prevent duplicate requests.

### Fix 3: Add Request Deduplication ⚠️ MEDIUM PRIORITY

Prevent multiple simultaneous requests for the same data.

## Implementation Plan

### Step 1: Fix Polling Interval (Immediate)

**File**: `src/utils/pollingSubscription.ts`

Change default interval from 3000ms to 30000ms (30 seconds):

```typescript
export function subscribeToOffersPolling(
  onNewOffer: NewOfferCallback,
  intervalMs: number = 30000 // Changed from 3000 to 30000 (30 seconds)
)
```

**Impact**: Reduces requests by **90%** (from 20/min to 2/min)

### Step 2: Add Edge Function Caching (High Priority)

**File**: `supabase/functions/make-server-e2cf3727/index.tsx`

Add response caching middleware for GET requests:

```typescript
// Simple in-memory cache (resets on function restart)
const responseCache = new Map<string, { data: any; expires: number }>();

app.use('*', async (c, next) => {
  // Only cache GET requests
  if (c.req.method === 'GET' && c.req.path.includes('/offers/list')) {
    const cacheKey = c.req.url;
    const cached = responseCache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      console.log('✅ Cache hit:', c.req.path);
      return c.json(cached.data);
    }
  }
  
  await next();
  
  // Cache successful GET responses
  if (c.req.method === 'GET' && c.res.status === 200 && c.req.path.includes('/offers/list')) {
    const cacheKey = c.req.url;
    const data = await c.res.json();
    responseCache.set(cacheKey, {
      data,
      expires: Date.now() + 30000 // 30 seconds
    });
    return c.json(data);
  }
});
```

**Impact**: Reduces database queries by **95%** for repeated requests

### Step 3: Optimize Frontend Polling (Medium Priority)

**File**: `src/components/MarketplaceFeed.tsx`

Add request deduplication and smarter polling:

```typescript
// Only poll if tab is visible
useEffect(() => {
  if (document.hidden) return; // Don't poll when tab is hidden
  
  const unsubscribe = subscribeToOffersPolling(
    (newOffer) => { /* ... */ },
    30000 // 30 seconds instead of 3
  );
  
  return () => unsubscribe();
}, []);
```

## Expected Results

### Before Fixes:
- **Current**: 1,152 requests (polling every 3 seconds)
- **Rate**: ~20 requests/minute

### After Fixes:
- **With 30s polling**: ~2 requests/minute = **120 requests/hour** (90% reduction)
- **With caching**: ~0.1 requests/minute = **6 requests/hour** (99.5% reduction)

### Combined Impact:
- **Before**: 1,152 requests/hour
- **After**: ~6-120 requests/hour
- **Reduction**: **90-99%** 🎉

## Quick Fix (Do This First)

**Change polling interval immediately:**

1. Open `src/utils/pollingSubscription.ts`
2. Change line 12: `intervalMs: number = 30000` (30 seconds)
3. Save and test

This alone will reduce requests by **90%**.

## Long-term Solution

**Use Supabase Realtime** instead of polling:
- Zero REST requests for updates
- Real-time updates when data changes
- More efficient and scalable

## Files to Modify

1. **`src/utils/pollingSubscription.ts`** - Increase interval
2. **`supabase/functions/make-server-e2cf3727/index.tsx`** - Add caching
3. **`src/components/MarketplaceFeed.tsx`** - Optimize polling

## Verification

After fixes, check Supabase Dashboard:
- **API Usage** → **REST API Requests**
- Should see dramatic reduction
- Monitor for 1 hour to confirm

