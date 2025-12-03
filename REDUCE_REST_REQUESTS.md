# How to Reduce REST Requests in Supabase (Currently at 207)

## Current Issues

REST requests are being made from:
1. **Edge Function calls** - Each API endpoint call counts as 1 REST request
2. **Database queries within Edge Functions** - Each `.from().select()` counts as 1 REST request
3. **Multiple sequential queries** - Some endpoints make 2-3 queries when 1 would work
4. **Frontend making multiple calls** - Components might be fetching data separately

## Optimization Strategies

### 1. ✅ Already Optimized: Use Database Views

**Status**: Views are created but need to be applied to more endpoints

**Current Usage**:
- ✅ `/offers/list` - Uses `user_offers_detailed` view (1 query instead of 2)
- ✅ `/steam/user` - Uses `user_activity_summary` view (1 query instead of multiple)
- ✅ `/offers/user/mine` - Uses `user_offers_detailed` view
- ✅ `/requests/received` - Uses `user_trade_requests_detailed` view

**Still Needs Optimization**:
- `/offers/:id` - Could use `user_offers_detailed` view
- `/offers/create` - Makes 2 queries (user profile + offer creation)
- Other endpoints making multiple queries

### 2. Combine Multiple Queries into Single Query

**Problem**: Some endpoints make 2-3 separate queries

**Example - `/offers/create` endpoint**:
```typescript
// Current: 2 REST requests
const { data: existingProfile } = await supabase.from('users').select(...).eq(...); // Request 1
const { data: offer } = await supabase.from('offers').insert(...).select(); // Request 2
```

**Solution**: Use database functions or combine with joins

### 3. Add Response Caching

**Strategy**: Cache responses for frequently accessed data

**Implementation**:
- Cache offers list for 30-60 seconds
- Cache user profiles for 5 minutes
- Use ETags for conditional requests

### 4. Batch Multiple Requests

**Strategy**: Combine multiple API calls into single batch request

**Example**: Instead of:
```typescript
getUserProfile()
getUserOffers()
getUserReputation()
```

Do:
```typescript
getUserCompleteData() // Uses user_activity_summary view - 1 request
```

### 5. Use Supabase Realtime Instead of Polling

**Strategy**: Subscribe to changes instead of polling

**Current**: Frontend might be polling `/offers/list` repeatedly
**Better**: Use Supabase Realtime subscriptions

## Immediate Actions

### Action 1: Apply Database Migration

The views are created but need to be applied:

```bash
supabase db push --project-ref fjouoltxkrdoxznodqzb
```

Or apply manually in Supabase Dashboard SQL Editor.

### Action 2: Optimize Remaining Endpoints

**File**: `supabase/functions/make-server-e2cf3727/index.tsx`

**Endpoints to optimize**:

1. **`/offers/:id` (GET)** - Use view instead of separate queries
2. **`/offers/create`** - Combine user lookup with offer creation
3. **`/offers/:id/request`** - Use view for offer data

### Action 3: Add Response Caching

Add caching middleware to Edge Function:

```typescript
// Cache responses for GET requests
const cache = new Map<string, { data: any; expires: number }>();

app.use('*', async (c, next) => {
  if (c.req.method === 'GET') {
    const cacheKey = c.req.url;
    const cached = cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return c.json(cached.data);
    }
  }
  
  await next();
  
  if (c.req.method === 'GET' && c.res.status === 200) {
    const data = await c.res.json();
    cache.set(cacheKey, {
      data,
      expires: Date.now() + 30000 // 30 seconds
    });
    return c.json(data);
  }
});
```

### Action 4: Reduce Frontend Calls

**Check frontend components**:
- Are components making duplicate API calls?
- Can multiple components share the same data?
- Are we polling when we should use realtime?

## Expected Reduction

### Before Optimization:
- `/offers/list`: 2 REST requests (offers + users)
- `/steam/user`: 1 REST request (but could be optimized)
- `/requests/received`: 2 REST requests (requests + users)
- **Total per page load**: ~10-15 REST requests

### After Optimization:
- `/offers/list`: 1 REST request (view)
- `/steam/user`: 1 REST request (view)
- `/requests/received`: 1 REST request (view)
- **Total per page load**: ~5-7 REST requests

### With Caching:
- First load: 5-7 REST requests
- Subsequent loads (30s cache): 0 REST requests
- **Average**: ~2-3 REST requests per page load

## Monitoring

### Check Supabase Dashboard:
1. Go to **Project Settings** → **API** → **Usage**
2. Check **REST API Requests** graph
3. Identify peak times and endpoints

### Add Logging:
```typescript
// Log REST request count per endpoint
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} - ${duration}ms`);
});
```

## Quick Wins (Do These First)

1. ✅ **Apply database migration** - Views are ready, just need to apply
2. ✅ **Update `/offers/:id` endpoint** - Use view instead of separate queries
3. ✅ **Add caching to `/offers/list`** - Most frequently called endpoint
4. ✅ **Check frontend polling** - Reduce unnecessary API calls

## Long-term Solutions

1. **Implement Supabase Realtime** - For live updates instead of polling
2. **Add Redis caching** - For better cache management
3. **Use GraphQL** - Single endpoint for multiple queries (if needed)
4. **Implement request batching** - Combine multiple API calls

## Code Changes Needed

### 1. Update `/offers/:id` endpoint:

```typescript
// Current: Makes separate queries
app.get("/make-server-e2cf3727/offers/:id", async (c) => {
  const { data: offer } = await supabase.from('offers').select('*')...; // Request 1
  const { data: user } = await supabase.from('users').select('*')...; // Request 2
  // ...
});

// Optimized: Use view
app.get("/make-server-e2cf3727/offers/:id", async (c) => {
  const { data: offer } = await supabase
    .from('user_offers_detailed')
    .select('*')
    .eq('id', offerId)
    .single(); // 1 request instead of 2
  // ...
});
```

### 2. Add caching middleware:

See Action 3 above for caching implementation.

### 3. Optimize `/offers/create`:

```typescript
// Use upsert with onConflict to combine operations
const { data: offer } = await supabase
  .from('offers')
  .insert({...})
  .select(`
    *,
    user:users!user_steam_id (
      steam_id,
      persona_name,
      avatar_url,
      profile_url,
      trade_url
    )
  `)
  .single(); // 1 request with join
```

## Expected Results

- **Current**: 207 REST requests
- **After views**: ~100-120 REST requests (50% reduction)
- **After caching**: ~30-50 REST requests (75% reduction)
- **After frontend optimization**: ~10-20 REST requests (90% reduction)

## Next Steps

1. Apply database migration
2. Update remaining endpoints to use views
3. Add caching middleware
4. Review frontend for duplicate calls
5. Monitor REST request count in Supabase Dashboard

