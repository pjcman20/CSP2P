# Supabase Auth Migration Progress

## Completed ✅

1. **Auth Helper Functions** (`supabase/functions/make-server-e2cf3727/auth.tsx`)
   - `createOrGetSupabaseUser()` - Creates/gets Supabase Auth user
   - `generateSupabaseSession()` - Generates JWT tokens
   - `verifySupabaseToken()` - Verifies auth tokens
   - `getAuthUserFromRequest()` - Extracts user from request headers

2. **Steam Callback Handler**
   - Updated to create Supabase Auth users
   - Returns Supabase Auth tokens instead of custom session IDs
   - Links users table to Supabase Auth users

3. **Updated Endpoints**
   - `/steam/user` - Now uses Supabase Auth tokens
   - `/steam/profile` - Now uses Supabase Auth tokens
   - `/steam/logout` - Simplified (handled by Supabase Auth client)
   - `/offers/create` - Now uses Supabase Auth tokens

## Remaining Endpoints to Update ⏳

All these endpoints still use `X-Session-ID` header and need to be updated to use `Authorization: Bearer <token>`:

### Offer Endpoints
- `/offers/user/mine` - Get user's offers
- `/offers/:id` - Get single offer
- `/offers/:id/view` - Track offer view
- `/offers/:id` (DELETE) - Delete offer
- `/offers/:id` (PUT) - Update offer
- `/offers/:id/request` - Create trade request

### Trade Request Endpoints
- `/requests/received` - Get received trade requests

### Reputation Endpoints
- `/reputation/vote` - Vote on reputation
- `/reputation/:steamId` - Get reputation

## Pattern for Updates

Replace this pattern:
```typescript
const sessionId = c.req.header('X-Session-ID');
if (!sessionId) {
  return c.json({ error: 'No session ID provided' }, 401);
}
const session = await kv.get(`session:${sessionId}`) as any;
if (!session || !session.steamId) {
  return c.json({ error: 'Invalid session' }, 401);
}
// Use session.steamId
```

With this:
```typescript
const authHeader = c.req.header('Authorization');
const authResult = await auth.getAuthUserFromRequest(authHeader);
if (!authResult) {
  return c.json({ error: 'Invalid or expired session' }, 401);
}
const { steamId, user: authUser } = authResult;
// Use steamId
```

## Next Steps

1. Update remaining backend endpoints
2. Create database migration for `auth_user_id` column
3. Update frontend to use Supabase Auth client
4. Update all frontend API calls to send tokens
5. Test complete authentication flow

