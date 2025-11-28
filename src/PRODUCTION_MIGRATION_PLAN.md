# 🚀 CS Trading Hub - Production Migration Plan

## **Complete Roadmap to Production-Ready Application**

**Version:** 1.0  
**Last Updated:** 2024  
**Estimated Timeline:** 2-3 weeks  
**Risk Level:** Medium (with rollback capability)

---

## 📊 **Current State Assessment**

### **What's Working:**
- ✅ Steam OAuth authentication
- ✅ Offer creation and browsing
- ✅ Trade request system
- ✅ Real Steam inventory fetching
- ✅ Reputation voting system
- ✅ Real-time updates via polling

### **Critical Issues:**
- ❌ No Row Level Security (database exposed)
- ❌ No input validation (XSS/injection risk)
- ❌ Single KV table (scalability bottleneck)
- ❌ No pagination (will break at 500-1000 offers)
- ❌ Race conditions on counters
- ❌ N+1 query patterns
- ❌ Session stored in localStorage (XSS vulnerable)

### **Target State:**
- ✅ Proper database schema with RLS
- ✅ Full input validation & sanitization
- ✅ Pagination on all endpoints
- ✅ Atomic operations (no race conditions)
- ✅ Optimized queries with indexes
- ✅ Rate limiting on all endpoints
- ✅ Production-grade security

---

## 🗓️ **Phase-by-Phase Plan**

---

## **PHASE 1: Database Schema Setup** 
### **Duration:** 1-2 days | **Risk:** Low | **Can Rollback:** Yes

### **Objective:**
Create proper database tables while keeping KV store operational.

### **Steps:**

#### **1.1 Create New Schema** ⏱️ 30 minutes

**Action Required:** YOU run SQL in Supabase Dashboard

1. Open: `https://supabase.com/dashboard/project/fjouoltxkrdoxznodqzb/sql/new`
2. Copy content from `/migrations/001_initial_schema.sql`
3. Run the SQL
4. Verify:
   - 8 tables created (users, sessions, offers, etc.)
   - RLS enabled on all tables (look for shield icons)
   - Policies created (check Table Editor → Policies tab)

**Verification Commands:**
```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- Test service role access
SELECT * FROM users LIMIT 1;
```

**Success Criteria:**
- [ ] All 8 tables exist
- [ ] RLS enabled on all tables
- [ ] Service role can query tables
- [ ] Anon role blocked from querying

---

#### **1.2 Enable RLS on KV Store** ⏱️ 5 minutes

**Action Required:** YOU run SQL

```sql
-- Protect existing KV data
ALTER TABLE kv_store_e2cf3727 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_kv_access" 
ON kv_store_e2cf3727
FOR ALL TO service_role 
USING (true) WITH CHECK (true);

CREATE POLICY "block_anon_kv_access" 
ON kv_store_e2cf3727
FOR ALL TO anon 
USING (false) WITH CHECK (false);
```

**Verification:**
```sql
-- This should work (you're using dashboard = service role)
SELECT * FROM kv_store_e2cf3727 LIMIT 5;

-- This should fail if you try with anon key
-- (Test in browser console with public key)
```

**Success Criteria:**
- [ ] KV store has RLS enabled
- [ ] Backend still works (test login, view offers)
- [ ] Direct database access blocked

---

#### **1.3 Install Database Utilities** ⏱️ 5 minutes

**Action Required:** I've already created `/supabase/functions/server/db.tsx`

**Verification:**
```bash
# Check file exists
ls -la /supabase/functions/server/db.tsx

# Check imports work (I'll test this in next phase)
```

**Success Criteria:**
- [ ] File exists with all CRUD operations
- [ ] No syntax errors
- [ ] Ready for use in Phase 2

---

### **Phase 1 Rollback Plan:**
If anything breaks:
```sql
-- Disable RLS on KV store
ALTER TABLE kv_store_e2cf3727 DISABLE ROW LEVEL SECURITY;

-- App continues working as before
```

---

## **PHASE 2: Input Validation & Sanitization**
### **Duration:** 1 day | **Risk:** Low | **Can Rollback:** Yes

### **Objective:**
Block XSS, injection, and data corruption attacks.

### **Steps:**

#### **2.1 Install Validation Library** ⏱️ 5 minutes

**Action Required:** I'll update imports in `/supabase/functions/server/index.tsx`

I'll add:
```typescript
import { z } from 'npm:zod@3';
import DOMPurify from 'npm:isomorphic-dompurify@2';
```

**Success Criteria:**
- [ ] Zod imports without errors
- [ ] DOMPurify imports without errors

---

#### **2.2 Create Validation Schemas** ⏱️ 1 hour

**Action Required:** I'll create `/supabase/functions/server/validation.tsx`

Schemas for:
- User profile data
- Trade URLs
- Offer items (offering/seeking)
- Trade request messages
- Reputation votes

**Example:**
```typescript
export const ItemSchema = z.object({
  name: z.string().min(1).max(200),
  wear: z.enum(['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred', 'ANY']).optional(),
  price: z.number().min(0).max(1000000).optional(),
  image: z.string().url().optional(),
  rarity: z.string().optional(),
});

export const OfferSchema = z.object({
  offering: z.array(ItemSchema).min(1).max(50),
  seeking: z.array(ItemSchema).min(1).max(50),
  notes: z.string().max(5000).optional(),
});
```

**Success Criteria:**
- [ ] All input types have schemas
- [ ] Schemas include length limits
- [ ] Enum values validated

---

#### **2.3 Add Validation to Endpoints** ⏱️ 2 hours

**Action Required:** I'll update all endpoints in `/supabase/functions/server/index.tsx`

**Before (vulnerable):**
```typescript
const { offering, seeking, notes } = await c.req.json();
if (!offering || !Array.isArray(offering)) {
  return c.json({ error: 'Invalid offering' }, 400);
}
```

**After (secure):**
```typescript
const body = await c.req.json();
const validated = OfferSchema.parse(body); // Throws if invalid

// Sanitize HTML
validated.notes = validated.notes ? DOMPurify.sanitize(validated.notes) : undefined;

// Use validated data
const offer = await createOffer(steamId, validated.offering, validated.seeking, validated.notes);
```

**Endpoints to Update:**
1. `/offers/create` - Validate offer data
2. `/offers/:id/update` - Validate updates
3. `/steam/profile` - Validate trade URL
4. `/requests/create` - Validate message
5. `/reputation/vote` - Validate vote type

**Success Criteria:**
- [ ] All endpoints validate input
- [ ] Invalid input returns 400 with error message
- [ ] HTML is sanitized in notes/messages
- [ ] Test with malicious payloads (XSS, oversized data)

---

#### **2.4 Test Validation** ⏱️ 30 minutes

**Test Cases:**

```bash
# Test 1: XSS in notes
curl -X POST /offers/create \
  -d '{"offering":[{"name":"Test"}],"seeking":[{"name":"Test"}],"notes":"<script>alert(1)</script>"}'
# Expected: Script tags removed

# Test 2: Oversized data
curl -X POST /offers/create \
  -d '{"offering":[{"name":"'$(python -c 'print("A"*10000)')
# Expected: 400 error, max length exceeded

# Test 3: Invalid wear
curl -X POST /offers/create \
  -d '{"offering":[{"name":"AK-47","wear":"INVALID"}],...}'
# Expected: 400 error, invalid wear value

# Test 4: Negative price
curl -X POST /offers/create \
  -d '{"offering":[{"name":"AK-47","price":-100}],...}'
# Expected: 400 error, price must be positive
```

**Success Criteria:**
- [ ] All malicious inputs rejected
- [ ] Error messages are helpful
- [ ] Valid data still works

---

### **Phase 2 Rollback Plan:**
No database changes - can revert code:
```bash
# Revert to previous commit
git revert HEAD

# Or comment out validation temporarily
# validation.tsx - just return input as-is
```

---

## **PHASE 3: Dual-Write Migration**
### **Duration:** 2-3 days | **Risk:** Medium | **Can Rollback:** Yes

### **Objective:**
Write data to BOTH KV store and new tables, read from tables with KV fallback.

### **Steps:**

#### **3.1 Update User Operations** ⏱️ 2 hours

**Action Required:** I'll update `/supabase/functions/server/index.tsx`

**Pattern:**
```typescript
// DUAL-WRITE MODE
async function saveUser(user: User) {
  try {
    // 1. Write to new tables (primary)
    await db.upsertUser(user);
    console.log('✅ Wrote to users table');
  } catch (error) {
    console.error('❌ Failed to write to tables:', error);
    // Don't throw - fallback to KV
  }
  
  // 2. Write to KV store (backup)
  await kv.set(`user:${user.steamId}`, user);
  console.log('✅ Wrote to KV store');
}

async function getUser(steamId: string): Promise<User | null> {
  // 1. Try new tables first
  try {
    const user = await db.getUser(steamId);
    if (user) {
      console.log('✅ Read from users table');
      return user;
    }
  } catch (error) {
    console.error('❌ Failed to read from tables:', error);
  }
  
  // 2. Fallback to KV store
  const kvUser = await kv.get(`user:${steamId}`);
  if (kvUser) {
    console.log('⚠️ Fallback: Read from KV store');
    return kvUser;
  }
  
  return null;
}
```

**Endpoints to Update:**
1. `/steam/callback` - Create user
2. `/steam/user` - Get user
3. `/steam/profile` - Update trade URL

**Success Criteria:**
- [ ] Users created in both stores
- [ ] Reads prefer tables, fallback to KV
- [ ] No functionality breaks
- [ ] Logs show which store is used

---

#### **3.2 Update Session Operations** ⏱️ 2 hours

**Action Required:** I'll apply dual-write pattern to sessions

**Endpoints:**
1. `/steam/callback` - Create session
2. `/steam/user` - Validate session
3. `/steam/logout` - Delete session

**Success Criteria:**
- [ ] Sessions in both stores
- [ ] Login/logout works
- [ ] Session validation works

---

#### **3.3 Update Offer Operations** ⏱️ 3 hours

**Action Required:** I'll apply dual-write pattern to offers

**Endpoints:**
1. `/offers/create` - Create offer
2. `/offers` - List offers (paginated from tables!)
3. `/offers/:id` - Get offer
4. `/offers/:id/update` - Update offer
5. `/offers/:id/delete` - Delete offer

**Critical Change - Pagination:**
```typescript
// OLD (loads ALL offers - breaks at scale)
app.get('/offers', async (c) => {
  const allOffers = await kv.getByPrefix('offer:');
  return c.json({ offers: allOffers }); // Could be 10,000 offers!
});

// NEW (paginated - scales infinitely)
app.get('/offers', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;
  
  const { offers, total } = await db.getOffers({ limit, offset });
  
  return c.json({
    offers,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  });
});
```

**Success Criteria:**
- [ ] Create offer writes to both stores
- [ ] List offers uses pagination from tables
- [ ] Individual offer reads from tables with KV fallback
- [ ] Update/delete work on both stores
- [ ] Frontend pagination works

---

#### **3.4 Update Trade Request Operations** ⏱️ 2 hours

**Action Required:** I'll apply dual-write pattern

**Endpoints:**
1. `/requests/create`
2. `/requests/sent`
3. `/requests/received`
4. `/requests/:id/accept`
5. `/requests/:id/reject`

**Success Criteria:**
- [ ] Requests in both stores
- [ ] All actions work
- [ ] Notifications still work

---

#### **3.5 Update Reputation Operations** ⏱️ 2 hours

**Action Required:** I'll apply dual-write pattern

**Special Note:** Tables have automatic counter updates via triggers!

**Endpoints:**
1. `/reputation/vote`
2. `/reputation/:steamId`

**Success Criteria:**
- [ ] Votes in both stores
- [ ] Counters accurate
- [ ] Completion rate calculated correctly
- [ ] No race conditions (tables use triggers)

---

#### **3.6 Testing - Dual Write Mode** ⏱️ 2 hours

**Test Scenarios:**

1. **Create new data** → Should appear in both stores
2. **Read data** → Should prefer tables
3. **Update data** → Should update both stores
4. **Delete data** → Should remove from both stores
5. **Table query fails** → Should fallback to KV
6. **Check logs** → Should see dual-write messages

**Verification:**
```sql
-- Check data in tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM offers WHERE deleted_at IS NULL;

-- Compare to KV
-- (Check Supabase dashboard → Database → kv_store_e2cf3727)
```

**Success Criteria:**
- [ ] Data consistent in both stores
- [ ] All features work
- [ ] Fallback works if tables fail
- [ ] Performance acceptable (dual-write adds latency)

---

### **Phase 3 Rollback Plan:**
```typescript
// Emergency rollback: Read from KV only
async function getUser(steamId: string) {
  // Comment out table reads, only use KV
  return await kv.get(`user:${steamId}`);
}

// Or: Deploy previous version
git revert HEAD~5  // Revert to before Phase 3
```

---

## **PHASE 4: Data Migration**
### **Duration:** 1-2 days | **Risk:** Medium | **Can Rollback:** Yes

### **Objective:**
Copy all existing KV data to new tables.

### **Steps:**

#### **4.1 Create Migration Script** ⏱️ 2 hours

**Action Required:** I'll create `/supabase/functions/server/migrate.tsx`

```typescript
/**
 * One-time migration script to copy data from KV to tables
 * Run via: curl POST /admin/migrate
 */

export async function migrateAllData() {
  console.log('🚀 Starting migration...');
  
  const results = {
    users: 0,
    sessions: 0,
    offers: 0,
    requests: 0,
    reputation: 0,
    errors: [],
  };
  
  try {
    // 1. Migrate users
    console.log('📦 Migrating users...');
    const kvUsers = await kv.getByPrefix('user:');
    for (const kvUser of kvUsers) {
      try {
        await db.upsertUser(kvUser);
        results.users++;
      } catch (error) {
        results.errors.push({ type: 'user', error });
      }
    }
    
    // 2. Migrate sessions
    console.log('📦 Migrating sessions...');
    const kvSessions = await kv.getByPrefix('session:');
    for (const kvSession of kvSessions) {
      // Skip expired sessions
      if (kvSession.expiresAt < Date.now()) continue;
      
      try {
        await db.createSession(kvSession.steamId, new Date(kvSession.expiresAt));
        results.sessions++;
      } catch (error) {
        results.errors.push({ type: 'session', error });
      }
    }
    
    // 3. Migrate offers
    console.log('📦 Migrating offers...');
    const kvOffers = await kv.getByPrefix('offer:');
    for (const kvOffer of kvOffers) {
      try {
        await db.createOffer(
          kvOffer.userId,
          kvOffer.offering,
          kvOffer.seeking,
          kvOffer.notes
        );
        results.offers++;
      } catch (error) {
        results.errors.push({ type: 'offer', error });
      }
    }
    
    // 4. Migrate trade requests
    console.log('📦 Migrating trade requests...');
    const kvRequests = await kv.getByPrefix('request:');
    for (const kvRequest of kvRequests) {
      try {
        await db.createTradeRequest(
          kvRequest.offerId,
          kvRequest.requesterSteamId,
          kvRequest.offerOwnerSteamId,
          kvRequest.message
        );
        results.requests++;
      } catch (error) {
        results.errors.push({ type: 'request', error });
      }
    }
    
    // 5. Migrate reputation votes
    console.log('📦 Migrating reputation...');
    const kvReputation = await kv.getByPrefix('reputation:');
    for (const kvRep of kvReputation) {
      // Parse old format
      const votes = kvRep.votes || [];
      for (const vote of votes) {
        try {
          await db.castReputationVote(
            kvRep.steamId,
            vote.voterSteamId,
            vote.voteType
          );
          results.reputation++;
        } catch (error) {
          results.errors.push({ type: 'reputation', error });
        }
      }
    }
    
    console.log('✅ Migration complete!', results);
    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
```

**Success Criteria:**
- [ ] Script can parse KV data
- [ ] Script can write to tables
- [ ] Error handling works
- [ ] Progress logging works

---

#### **4.2 Add Migration Endpoint** ⏱️ 30 minutes

**Action Required:** I'll add to `/supabase/functions/server/index.tsx`

```typescript
// ADMIN ENDPOINT - Should be secured!
app.post('/admin/migrate', async (c) => {
  // TODO: Add admin authentication
  const adminToken = c.req.header('X-Admin-Token');
  if (adminToken !== Deno.env.get('ADMIN_SECRET')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const results = await migrateAllData();
  return c.json(results);
});

// Check migration status
app.get('/admin/migration-status', async (c) => {
  const kvCount = await kv.count(); // You'll need to implement this
  const tableCount = await db.from('offers').select('count').single();
  
  return c.json({
    kv: kvCount,
    tables: tableCount,
    percentage: (tableCount / kvCount) * 100,
  });
});
```

**Success Criteria:**
- [ ] Endpoint requires admin token
- [ ] Returns migration results
- [ ] Can check progress

---

#### **4.3 Run Migration** ⏱️ 30 minutes

**Action Required:** YOU trigger migration

```bash
# Set admin secret in Supabase dashboard
# Go to: Project Settings → Edge Functions → Environment Variables
# Add: ADMIN_SECRET = your-random-secret

# Run migration
curl -X POST \
  https://fjouoltxkrdoxznodqzb.supabase.co/functions/v1/make-server-e2cf3727/admin/migrate \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-Admin-Token: your-random-secret"

# Monitor progress
curl https://fjouoltxkrdoxznodqzb.supabase.co/functions/v1/make-server-e2cf3727/admin/migration-status \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-Admin-Token: your-random-secret"
```

**During Migration:**
- App stays online (dual-write mode)
- New data goes to both stores
- Old data gradually copied

**Success Criteria:**
- [ ] Migration completes without errors
- [ ] All KV data in tables
- [ ] Counts match
- [ ] App still works

---

#### **4.4 Verify Data Integrity** ⏱️ 1 hour

**Action Required:** YOU + I run verification queries

```sql
-- Count records
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'offers', COUNT(*) FROM offers WHERE deleted_at IS NULL
UNION ALL
SELECT 'trade_requests', COUNT(*) FROM trade_requests
UNION ALL
SELECT 'reputation_votes', COUNT(*) FROM reputation_votes;

-- Sample data checks
SELECT * FROM users LIMIT 5;
SELECT * FROM offers WHERE deleted_at IS NULL LIMIT 5;

-- Check relationships
SELECT o.id, u.persona_name, array_length(o.offering, 1) as item_count
FROM offers o
JOIN users u ON o.user_steam_id = u.steam_id
LIMIT 10;

-- Check reputation calculations
SELECT 
  r.steam_id,
  r.completed_trades,
  r.reversed_trades,
  r.total_votes,
  r.completion_rate,
  COUNT(rv.id) as actual_vote_count
FROM reputation r
LEFT JOIN reputation_votes rv ON r.steam_id = rv.target_steam_id
GROUP BY r.steam_id, r.completed_trades, r.reversed_trades, r.total_votes, r.completion_rate
HAVING COUNT(rv.id) != r.total_votes;  -- Should return 0 rows
```

**Test User Flows:**
1. Login → Should work
2. Create offer → Should appear
3. Browse offers → Should show all (paginated)
4. Send trade request → Should work
5. Vote on reputation → Counter should update

**Success Criteria:**
- [ ] All counts match expectations
- [ ] Sample data looks correct
- [ ] Relationships intact
- [ ] User flows work end-to-end

---

### **Phase 4 Rollback Plan:**
```typescript
// If migration corrupted data:

// 1. Stop dual-write, go back to KV-only
async function getUser(steamId: string) {
  return await kv.get(`user:${steamId}`);
}

// 2. Drop tables and re-create
// (Run in Supabase SQL editor)
DROP TABLE IF EXISTS reputation_votes CASCADE;
DROP TABLE IF EXISTS reputation CASCADE;
DROP TABLE IF EXISTS trade_requests CASCADE;
DROP TABLE IF EXISTS offer_views CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Re-run migration SQL
```

---

## **PHASE 5: Tables-Only Mode**
### **Duration:** 1 day | **Risk:** Low | **Can Rollback:** Yes

### **Objective:**
Switch to reading/writing only from tables. KV becomes backup.

### **Steps:**

#### **5.1 Remove KV Reads** ⏱️ 2 hours

**Action Required:** I'll update all functions to remove fallback

**Before (dual-read):**
```typescript
async function getUser(steamId: string) {
  // Try tables
  const user = await db.getUser(steamId);
  if (user) return user;
  
  // Fallback to KV
  return await kv.get(`user:${steamId}`);
}
```

**After (tables-only):**
```typescript
async function getUser(steamId: string) {
  return await db.getUser(steamId);
  // No fallback - tables are source of truth
}
```

**Success Criteria:**
- [ ] All reads from tables
- [ ] No KV fallback code
- [ ] App still works

---

#### **5.2 Keep KV Writes for Backup** ⏱️ 1 hour

**Action Required:** I'll add background KV writes

```typescript
async function saveUser(user: User) {
  // 1. Write to tables (primary, blocking)
  await db.upsertUser(user);
  
  // 2. Write to KV (backup, non-blocking)
  kv.set(`user:${user.steamId}`, user).catch(err => {
    console.error('KV backup write failed:', err);
    // Don't throw - KV is backup only
  });
}
```

**Success Criteria:**
- [ ] Tables are primary
- [ ] KV updates in background
- [ ] KV write failures don't break app

---

#### **5.3 Testing** ⏱️ 2 hours

**Full regression test:**

1. **Authentication**
   - [ ] Login with Steam
   - [ ] Session persists
   - [ ] Logout works

2. **Offers**
   - [ ] Create offer
   - [ ] Browse offers (paginated)
   - [ ] View single offer
   - [ ] Update offer
   - [ ] Delete offer

3. **Trade Requests**
   - [ ] Send request
   - [ ] View sent requests
   - [ ] View received requests
   - [ ] Accept request
   - [ ] Reject request

4. **Reputation**
   - [ ] Vote completed
   - [ ] Vote reversed
   - [ ] Update vote
   - [ ] View reputation

5. **Performance**
   - [ ] Offers load fast (< 500ms)
   - [ ] Pagination works
   - [ ] No N+1 queries

**Success Criteria:**
- [ ] All features work
- [ ] Performance improved
- [ ] No errors in logs
- [ ] Users don't notice change

---

### **Phase 5 Rollback Plan:**
```typescript
// Re-enable KV reads
async function getUser(steamId: string) {
  const user = await db.getUser(steamId).catch(() => null);
  if (user) return user;
  
  // Emergency fallback
  return await kv.get(`user:${steamId}`);
}
```

---

## **PHASE 6: Security Hardening**
### **Duration:** 2-3 days | **Risk:** Low | **Can Rollback:** Yes

### **Objective:**
Add rate limiting, session improvements, and final security fixes.

### **Steps:**

#### **6.1 Implement Rate Limiting** ⏱️ 3 hours

**Action Required:** I'll add rate limiting middleware

```typescript
// Rate limit middleware
async function rateLimitMiddleware(
  c: Context,
  next: Next,
  config: { maxRequests: number; windowSeconds: number; key: string }
) {
  const steamId = c.get('steamId'); // From session
  const key = `${config.key}:${steamId || c.req.header('CF-Connecting-IP')}`;
  
  const allowed = await db.checkRateLimit(key, config.maxRequests, config.windowSeconds);
  
  if (!allowed) {
    return c.json({
      error: 'Rate limit exceeded',
      retryAfter: config.windowSeconds,
    }, 429);
  }
  
  await next();
}

// Apply to endpoints
app.post('/offers/create',
  (c, next) => rateLimitMiddleware(c, next, { maxRequests: 10, windowSeconds: 3600, key: 'offers:create' }),
  async (c) => {
    // Create offer logic
  }
);

app.post('/reputation/vote',
  (c, next) => rateLimitMiddleware(c, next, { maxRequests: 50, windowSeconds: 86400, key: 'reputation:vote' }),
  async (c) => {
    // Vote logic
  }
);
```

**Rate Limits:**
- Offer creation: 10 per hour
- Trade requests: 20 per hour
- Reputation votes: 50 per day
- General API: 100 per minute

**Success Criteria:**
- [ ] Rate limits enforced
- [ ] 429 status returned when exceeded
- [ ] Legitimate users not affected

---

#### **6.2 Improve Session Security** ⏱️ 4 hours

**Action Required:** I'll add session fingerprinting and httpOnly cookies

**Changes:**

1. **Add Session Fingerprinting**
```typescript
function generateFingerprint(req: Request): string {
  const components = [
    req.header('User-Agent'),
    req.header('Accept-Language'),
    req.header('CF-Connecting-IP'),
  ];
  return hashComponents(components);
}

// On session create
const fingerprint = generateFingerprint(c.req);
await db.createSession(steamId, expiresAt, { fingerprint });

// On session validate
const session = await db.getSession(sessionId);
const currentFingerprint = generateFingerprint(c.req);

if (session.fingerprint !== currentFingerprint) {
  // Possible session hijacking
  console.warn('Session fingerprint mismatch');
  await db.deleteSession(sessionId);
  return c.json({ error: 'Session invalid' }, 401);
}
```

2. **Move to httpOnly Cookies** (if possible in Figma Make env)
```typescript
// Set cookie on login
c.header('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);

// Read cookie on requests
const sessionId = c.req.cookie('session');
```

3. **Add "Logout All Devices"**
```typescript
app.post('/steam/logout-all', async (c) => {
  const session = await validateSession(c);
  await db.deleteAllUserSessions(session.steam_id);
  return c.json({ success: true });
});
```

**Success Criteria:**
- [ ] Fingerprinting detects hijacking
- [ ] Cookies more secure (if possible)
- [ ] Logout all devices works

---

#### **6.3 Fix CORS** ⏱️ 30 minutes

**Action Required:** I'll restrict CORS origins

```typescript
// BEFORE
app.use("/*", cors({ origin: "*" }));  // ❌ Allows any site

// AFTER
const ALLOWED_ORIGINS = [
  'https://fjouoltxkrdoxznodqzb.supabase.co',
  'https://yourapp.com',  // Add your custom domain
  'http://localhost:3000',  // Dev only (remove in production)
];

app.use("/*", cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    console.warn('Blocked CORS request from:', origin);
    return false;
  },
  credentials: true,
}));
```

**Success Criteria:**
- [ ] Only allowed origins can make requests
- [ ] Blocked origins get CORS error
- [ ] Legitimate requests work

---

#### **6.4 Add Audit Logging** ⏱️ 2 hours

**Action Required:** I'll add logging for security events

```typescript
interface AuditLog {
  event: string;
  steamId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  timestamp: string;
}

async function logAuditEvent(log: AuditLog) {
  console.log('[AUDIT]', JSON.stringify(log));
  // Could also write to separate audit table
}

// Use in endpoints
app.post('/steam/login', async (c) => {
  await logAuditEvent({
    event: 'login_attempt',
    ipAddress: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  // ... login logic
});

app.post('/offers/:id/delete', async (c) => {
  await logAuditEvent({
    event: 'offer_deleted',
    steamId: session.steam_id,
    metadata: { offerId: c.req.param('id') },
    timestamp: new Date().toISOString(),
  });
  // ... delete logic
});
```

**Events to Log:**
- login_attempt, login_success, login_failure
- session_created, session_expired, session_hijack_detected
- offer_created, offer_updated, offer_deleted
- trade_request_sent, trade_request_accepted
- reputation_vote_cast
- rate_limit_exceeded
- validation_failed (potential attacks)

**Success Criteria:**
- [ ] Security events logged
- [ ] Logs include context
- [ ] Easy to search/analyze

---

#### **6.5 Add Health Check** ⏱️ 30 minutes

**Action Required:** I'll add monitoring endpoint

```typescript
app.get('/health', async (c) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      sessions: 0,
      offers: 0,
    },
  };

  try {
    // Check database
    health.checks.database = await db.healthCheck();
    
    // Count active sessions
    const { count: sessionCount } = await db.from('sessions')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());
    health.checks.sessions = sessionCount || 0;
    
    // Count active offers
    const { count: offerCount } = await db.from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null);
    health.checks.offers = offerCount || 0;
    
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    return c.json(health, 500);
  }

  return c.json(health);
});
```

**Success Criteria:**
- [ ] Health check returns status
- [ ] Shows database connectivity
- [ ] Shows key metrics
- [ ] Returns 500 if unhealthy

---

### **Phase 6 Rollback Plan:**
All changes are additive - can disable features individually:
```typescript
// Disable rate limiting
// Comment out middleware calls

// Disable fingerprinting
// Comment out fingerprint checks

// Revert CORS
app.use("/*", cors({ origin: "*" }));
```

---

## **PHASE 7: Testing & Verification**
### **Duration:** 2-3 days | **Risk:** Low | **No Rollback Needed**

### **Objective:**
Comprehensive testing before declaring production-ready.

### **Steps:**

#### **7.1 Functional Testing** ⏱️ 4 hours

**Test Matrix:**

| Feature | Test Case | Expected Result | Status |
|---------|-----------|-----------------|--------|
| **Auth** | Login with Steam | Redirect to Steam, return with session | ⬜ |
| | Session persists | Refresh page, still logged in | ⬜ |
| | Logout | Session deleted, redirected to home | ⬜ |
| | Expired session | Auto-logout, prompt to login | ⬜ |
| **Offers** | Create offer | Appears in marketplace | ⬜ |
| | Browse offers | Paginated list loads | ⬜ |
| | View offer | Full details shown | ⬜ |
| | Update offer | Changes saved | ⬜ |
| | Delete offer | Removed from marketplace | ⬜ |
| **Requests** | Send request | Owner notified | ⬜ |
| | Accept request | Status updated, Steam URLs shown | ⬜ |
| | Reject request | Status updated | ⬜ |
| **Reputation** | Vote completed | Counter increments | ⬜ |
| | Vote reversed | Counter adjusts | ⬜ |
| | Change vote | Updates correctly | ⬜ |
| | View reputation | Shows accurate stats | ⬜ |

**Success Criteria:**
- [ ] All test cases pass
- [ ] No errors in console
- [ ] UI updates correctly

---

#### **7.2 Security Testing** ⏱️ 4 hours

**Attack Scenarios:**

1. **XSS Injection**
```javascript
// Test in offer notes
<script>alert(document.cookie)</script>
<img src=x onerror="alert(1)">
// Should be sanitized
```

2. **SQL Injection** (should be prevented by parameterized queries)
```sql
'; DROP TABLE users; --
```

3. **CSRF** (should be prevented by CORS + origin check)
```javascript
// From evil.com
fetch('https://yourapp/offers/create', {
  method: 'POST',
  body: JSON.stringify({ malicious: 'data' })
});
// Should be blocked
```

4. **Session Hijacking**
```javascript
// Steal session ID
localStorage.getItem('steam_session_id')
// Use from different IP/browser
// Should be detected by fingerprint
```

5. **Rate Limit Bypass**
```bash
# Send 100 requests rapidly
for i in {1..100}; do
  curl /offers/create &
done
# Should be rate limited
```

6. **Direct Database Access**
```javascript
// Try with public anon key
const { data } = await supabase.from('users').select('*');
// Should return empty/error
```

**Success Criteria:**
- [ ] XSS blocked
- [ ] SQL injection not possible
- [ ] CSRF prevented
- [ ] Session hijacking detected
- [ ] Rate limits enforced
- [ ] Direct DB access blocked

---

#### **7.3 Performance Testing** ⏱️ 3 hours

**Load Tests:**

```bash
# Test 1: Browse offers (1000 requests)
ab -n 1000 -c 10 https://yourapp/api/offers

# Target: < 500ms average
# Target: < 1000ms p95

# Test 2: Create offer (100 requests)
ab -n 100 -c 5 -p offer.json https://yourapp/api/offers/create

# Target: < 1000ms average

# Test 3: Concurrent users (simulate 50 users)
# (Use tool like k6 or Artillery)
```

**Database Performance:**
```sql
-- Check slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.1;
```

**Success Criteria:**
- [ ] API responses < 500ms avg
- [ ] No queries > 1s
- [ ] Pagination working (not loading all data)
- [ ] Indexes used correctly
- [ ] No N+1 queries

---

#### **7.4 Scale Testing** ⏱️ 2 hours

**Simulate Growth:**

```sql
-- Insert 10,000 fake offers
INSERT INTO offers (user_steam_id, offering, seeking, notes, status)
SELECT 
  '76561198' || (random() * 1000000)::int,
  '[{"name":"AK-47 | Redline","wear":"Field-Tested"}]'::jsonb,
  '[{"name":"M4A4 | Asiimov","wear":"Field-Tested"}]'::jsonb,
  'Test offer ' || generate_series,
  'active'
FROM generate_series(1, 10000);

-- Test pagination still fast
EXPLAIN ANALYZE
SELECT * FROM offers
WHERE status = 'active' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 5000;
-- Target: < 100ms
```

**Success Criteria:**
- [ ] 10,000+ offers load fast
- [ ] Pagination efficient at any page
- [ ] Search/filters still work
- [ ] Database not overwhelmed

---

#### **7.5 User Acceptance Testing** ⏱️ 4 hours

**Recruit Beta Testers:**
- 3-5 real users
- Ask them to use app normally
- Collect feedback

**Feedback Form:**
- Did everything work?
- Any errors or bugs?
- Was it fast enough?
- Any confusing UX?
- Security concerns?

**Success Criteria:**
- [ ] No major bugs reported
- [ ] Users can complete all workflows
- [ ] Performance acceptable
- [ ] No security issues found

---

### **Phase 7 Deliverables:**
- [ ] Test results documented
- [ ] Performance benchmarks recorded
- [ ] Security audit passed
- [ ] User feedback collected
- [ ] Bug list (if any) created

---

## **PHASE 8: Cleanup & Documentation**
### **Duration:** 1 day | **Risk:** None

### **Objective:**
Remove migration code, document changes, prepare for production.

### **Steps:**

#### **8.1 Remove Migration Code** ⏱️ 1 hour

**Action Required:** I'll clean up temporary code

**Remove:**
- [ ] Dual-write logic (KV writes)
- [ ] KV fallback reads
- [ ] Migration endpoints (`/admin/migrate`)
- [ ] Migration scripts (`migrate.tsx`)
- [ ] Debug logging (dual-write messages)

**Keep:**
- [ ] All table-based operations
- [ ] Validation
- [ ] Rate limiting
- [ ] Security features

---

#### **8.2 Archive KV Data** ⏱️ 30 minutes

**Action Required:** YOU export KV data for backup

```sql
-- Export KV store to JSON
COPY (
  SELECT key, value, created_at
  FROM kv_store_e2cf3727
  ORDER BY key
) TO '/tmp/kv_backup.json';

-- Download from Supabase dashboard
-- Store securely (S3, etc.)
```

**Optional:** Delete old KV entries
```sql
-- After confirmed backup
DELETE FROM kv_store_e2cf3727
WHERE key NOT LIKE 'system:%';  -- Keep system keys if any
```

---

#### **8.3 Update Documentation** ⏱️ 2 hours

**Action Required:** I'll create production docs

Files to create:
1. `/docs/DATABASE_SCHEMA.md` - Table structure, relationships
2. `/docs/API_REFERENCE.md` - All endpoints, request/response formats
3. `/docs/SECURITY.md` - Security measures, policies
4. `/docs/DEPLOYMENT.md` - How to deploy, environment variables
5. `/docs/MONITORING.md` - Health checks, logs, alerts

---

#### **8.4 Create Runbook** ⏱️ 1 hour

**Action Required:** I'll create `/docs/RUNBOOK.md`

Contents:
- How to handle common issues
- Emergency rollback procedures
- Database maintenance (cleanup sessions, etc.)
- Performance monitoring
- Incident response

---

#### **8.5 Environment Variables Checklist** ⏱️ 30 minutes

**Required Variables:**
```bash
# Supabase (already set)
SUPABASE_URL=https://fjouoltxkrdoxznodqzb.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Steam (already set)
STEAM_API_KEY=your-key

# New for production
ADMIN_SECRET=random-secret-here
CORS_ORIGINS=https://yourapp.com,https://www.yourapp.com
NODE_ENV=production
```

**Verify:** All secrets set in Supabase dashboard

---

## **FINAL CHECKLIST - PRODUCTION READY** ✅

### **Database:**
- [ ] Schema created with all 8 tables
- [ ] RLS enabled on all tables
- [ ] Indexes created and used
- [ ] Triggers working (reputation updates)
- [ ] Views created for common queries
- [ ] Cleanup functions scheduled

### **Security:**
- [ ] Input validation on all endpoints
- [ ] HTML sanitization
- [ ] Rate limiting enforced
- [ ] CORS restricted to allowed origins
- [ ] Session fingerprinting active
- [ ] Audit logging enabled
- [ ] No direct database access possible

### **Performance:**
- [ ] Pagination implemented
- [ ] Queries optimized (no N+1)
- [ ] Indexes used correctly
- [ ] Response times < 500ms
- [ ] Can handle 10,000+ offers

### **Code Quality:**
- [ ] All TypeScript types defined
- [ ] Error handling on all endpoints
- [ ] Logging for debugging
- [ ] Comments on complex logic
- [ ] No dead code

### **Documentation:**
- [ ] Database schema documented
- [ ] API endpoints documented
- [ ] Security measures documented
- [ ] Deployment guide created
- [ ] Runbook for operations

### **Testing:**
- [ ] All features tested
- [ ] Security tests passed
- [ ] Performance tests passed
- [ ] User acceptance testing done
- [ ] No critical bugs

---

## **POST-LAUNCH: Ongoing Maintenance**

### **Daily:**
- [ ] Check health endpoint
- [ ] Review error logs
- [ ] Monitor performance metrics

### **Weekly:**
- [ ] Run cleanup functions (sessions, rate limits)
- [ ] Review audit logs for suspicious activity
- [ ] Check database size and growth

### **Monthly:**
- [ ] Review and optimize slow queries
- [ ] Update dependencies
- [ ] Security audit
- [ ] Backup database

---

## **ROLLBACK PROCEDURES**

### **Emergency Rollback (Complete Failure):**
```bash
# 1. Revert to last known good deployment
git revert HEAD~10
git push origin main

# 2. Re-enable KV store
ALTER TABLE kv_store_e2cf3727 DISABLE ROW LEVEL SECURITY;

# 3. Deploy previous version
# (Wait for Supabase to redeploy)

# 4. Verify app works
curl https://yourapp/health
```

### **Partial Rollback (One Feature Broken):**
```typescript
// Disable specific feature
// Example: Disable rate limiting
app.post('/offers/create', async (c) => {
  // Comment out rate limit middleware
  // Continue with offer creation
});
```

### **Data Corruption:**
```sql
-- Restore from backup
-- (Use KV export from Phase 8.2)

-- Or: Point reads back to KV store temporarily
```

---

## **SUCCESS METRICS**

### **Technical Metrics:**
- ✅ 100% uptime during migration
- ✅ < 500ms API response times
- ✅ 0 data loss incidents
- ✅ 0 security breaches
- ✅ Database can scale to 100,000+ offers

### **User Metrics:**
- ✅ No user-reported bugs
- ✅ No downtime noticed by users
- ✅ Faster page loads
- ✅ Positive user feedback

---

## **ESTIMATED TOTAL TIME**

| Phase | Duration | Risk | Priority |
|-------|----------|------|----------|
| 1. Database Setup | 1-2 days | Low | 🔴 Critical |
| 2. Input Validation | 1 day | Low | 🔴 Critical |
| 3. Dual-Write Migration | 2-3 days | Medium | 🔴 Critical |
| 4. Data Migration | 1-2 days | Medium | 🟠 High |
| 5. Tables-Only Mode | 1 day | Low | 🟠 High |
| 6. Security Hardening | 2-3 days | Low | 🟠 High |
| 7. Testing | 2-3 days | Low | 🟡 Medium |
| 8. Cleanup | 1 day | None | 🟢 Low |

**Total: 11-17 days (2-3 weeks)**

With focused work: **2 weeks**  
With thorough testing: **3 weeks**

---

## **READY TO START?**

Next steps:
1. **YOU:** Run `/migrations/001_initial_schema.sql` in Supabase
2. **YOU:** Enable RLS on kv_store table
3. **ME:** Implement Phase 2 (Input Validation)
4. **ME:** Implement Phase 3 (Dual-Write)
5. **Together:** Test and verify each phase

**Let's do this! 🚀**

Which phase should we tackle first?
