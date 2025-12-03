# Authentication System Analysis

## Current Implementation

### Authentication Flow

1. **Frontend Initiation** (`src/utils/steamAuth.ts`)
   - User clicks "Sign in with Steam"
   - Calls `/steam/login` endpoint to get Steam OpenID URL
   - Redirects to Steam for authentication

2. **Steam Callback** (`supabase/functions/make-server-e2cf3727/index.tsx`)
   - Steam redirects back with OpenID parameters
   - Backend verifies Steam login via OpenID
   - Fetches user profile from Steam API
   - Creates custom session in KV store (in-memory)
   - Returns custom `sessionId` (UUID)

3. **Session Management**
   - Sessions stored in KV store: `session:${sessionId}`
   - Session data includes: `steamId`, `personaName`, `avatarUrl`, `profileUrl`, `expiresAt`
   - Frontend stores `sessionId` in `localStorage`
   - API calls include `X-Session-ID` header

4. **User Storage**
   - Custom `users` table stores Steam user data
   - No link to Supabase Auth users
   - Users created via upsert in `users` table

### Current Issues

❌ **No Supabase Auth Integration**
- Not using Supabase Auth system at all
- No Supabase Auth users created
- Cannot leverage Supabase Auth features

❌ **Custom Session Management**
- Sessions stored in KV store (in-memory, not persistent)
- Custom session IDs instead of JWT tokens
- No token expiration/refresh mechanism

❌ **No JWT Tokens**
- Not using Supabase's JWT token system
- Cannot use RLS policies with `auth.uid()`
- Missing security benefits of JWT tokens

❌ **Limited Scalability**
- KV store sessions don't persist across edge function restarts
- No centralized session management
- Hard to implement features like "logout all devices"

### Current Code Locations

**Frontend Auth:**
- `src/utils/steamAuth.ts` - Custom Steam auth utilities
- `src/components/SteamLoginButton.tsx` - Login button component
- `src/components/SteamCallback.tsx` - Callback handler

**Backend Auth:**
- `supabase/functions/make-server-e2cf3727/index.tsx` - Steam auth endpoints
- `supabase/functions/make-server-e2cf3727/steam.tsx` - Steam OpenID utilities
- `supabase/functions/make-server-e2cf3727/kv_store.tsx` - Session storage

**Database:**
- `supabase/migrations/20251128124334_initial_schema.sql` - Users table schema
- No `auth_user_id` column linking to Supabase Auth

### API Endpoints Using Custom Sessions

All these endpoints use `X-Session-ID` header:
- `/steam/user` - Get current user
- `/steam/profile` - Update profile
- `/steam/logout` - Logout
- `/offers/create` - Create offer
- `/offers/user/mine` - Get user's offers
- `/offers/:id` - Get/update/delete offer
- `/requests/received` - Get trade requests
- `/reputation/vote` - Vote on reputation

### Required Changes

1. **Backend Changes**
   - Create Supabase Auth users after Steam login
   - Return Supabase Auth tokens instead of session IDs
   - Verify Supabase Auth tokens in API endpoints
   - Remove KV store session management

2. **Frontend Changes**
   - Initialize Supabase Auth client
   - Use Supabase Auth session management
   - Send Supabase Auth tokens in API calls
   - Remove custom session storage

3. **Database Changes**
   - Add `auth_user_id` column to `users` table
   - Link custom users to Supabase Auth users
   - Update RLS policies to use `auth.uid()`

4. **Migration Strategy**
   - Handle existing sessions (if any)
   - Migrate existing users to Supabase Auth
   - Update all API endpoints gradually

