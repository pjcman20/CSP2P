# 🔒 CS Trading Hub - Production Security Roadmap

## ✅ **COMPLETED (Phase 1)**
- [x] Production database schema with 8 tables
- [x] Row Level Security (RLS) enabled on all tables
- [x] Input validation with Zod schemas
- [x] HTML sanitization for XSS prevention
- [x] Proper foreign key constraints
- [x] Soft deletes for offers
- [x] Database triggers for view counting
- [x] Trade URL validation

---

## 🚨 **CRITICAL - DO BEFORE LAUNCH (Phase 2)**

### 1. **Rate Limiting Implementation** ⚠️ HIGH PRIORITY
**Status:** Table exists but middleware NOT implemented

**Current Risk:** API abuse, spam, DoS attacks

**Action Items:**
```typescript
// Create rate limiting middleware in /supabase/functions/server/rate_limiter.tsx
- [ ] Implement rate limit checks using rate_limits table
- [ ] Apply to all POST/PUT/DELETE endpoints
- [ ] Enforce limits from validation.tsx RateLimitConfig:
      - Offers: 10 creates/hour, 20 updates/hour
      - Trade requests: 20/hour
      - Reputation votes: 50/day
- [ ] Return 429 status with retry-after header
- [ ] Clean up expired rate limits periodically
```

**Impact:** Without this, malicious users can spam offers, crash your server, or manipulate reputation

---

### 2. **Session Security Migration** ⚠️ HIGH PRIORITY
**Status:** Using KV store instead of sessions table

**Current Risk:** Session hijacking, no audit trail, can't revoke sessions

**Action Items:**
```typescript
- [ ] Migrate from KV store to database sessions table
- [ ] Store session fingerprint (IP + User-Agent hash)
- [ ] Implement session hijacking detection:
      - Compare fingerprint on each request
      - Invalidate session if fingerprint changes
- [ ] Add session revocation endpoint
- [ ] Implement "logout all devices" feature
- [ ] Set secure session expiration (7 days max)
- [ ] Clean up expired sessions with cron job
```

**Migration Path:**
1. Update auth endpoints to write to `sessions` table
2. Add fingerprint generation helper
3. Add session validation middleware
4. Keep KV for backward compatibility initially
5. Phase out KV after testing

---

### 3. **CORS Security** ⚠️ HIGH PRIORITY
**Status:** Currently allows ALL origins (`origin: "*"`)

**Current Risk:** CSRF attacks, unauthorized API access

**Action Items:**
```typescript
// In /supabase/functions/server/index.tsx
- [ ] Replace origin: "*" with allowlist:
      origin: [
        'https://your-domain.com',
        'https://staging.your-domain.com',
        ...(Deno.env.get('ENVIRONMENT') === 'development' 
          ? ['http://localhost:5173', 'http://localhost:3000'] 
          : [])
      ]
- [ ] Set credentials: true for cookies/auth headers
- [ ] Restrict allowHeaders to only necessary headers
```

---

### 4. **Environment Variable Security** ⚠️ HIGH PRIORITY
**Status:** Service role key used in backend (correct), but need validation

**Action Items:**
```typescript
- [ ] Add startup validation for required env vars:
      - SUPABASE_URL
      - SUPABASE_SERVICE_ROLE_KEY (backend only - NEVER frontend)
      - SUPABASE_ANON_KEY (frontend safe)
      - STEAM_API_KEY
- [ ] Validate format of env vars at startup
- [ ] Exit process if critical vars missing
- [ ] Add env var documentation
- [ ] Ensure SUPABASE_SERVICE_ROLE_KEY never leaks to frontend
- [ ] Rotate keys if ever exposed
```

---

### 5. **Error Handling - No Info Leakage** ⚠️ HIGH PRIORITY
**Status:** Some endpoints leak database error details

**Current Risk:** Attackers learn about your database schema

**Action Items:**
```typescript
- [ ] Create error response helper:
      function safeError(userMessage: string, logDetails: any) {
        console.error('Detailed error:', logDetails);
        return c.json({ error: userMessage }, 500);
      }
- [ ] Remove all error.message and error.details from responses
- [ ] Use generic messages like "Failed to create offer"
- [ ] Log full errors server-side for debugging
- [ ] Add error correlation IDs for support tickets
```

---

### 6. **SQL Injection Prevention** ✅ ALREADY SAFE (verify)
**Status:** Using Supabase client (parameterized queries)

**Verification:**
```typescript
- [ ] Review all database queries - ensure NO raw SQL
- [ ] Verify all .eq(), .in(), .filter() use parameterized values
- [ ] Check for string concatenation in queries (FORBIDDEN)
```

---

## 🔧 **IMPORTANT - DO SOON (Phase 3)**

### 7. **Content Security Policy (CSP)**
**Action Items:**
```typescript
- [ ] Add CSP headers to all responses
- [ ] Whitelist only trusted domains for images/scripts
- [ ] Block inline scripts (use nonce or hashes)
- [ ] Enable upgrade-insecure-requests
- [ ] Add frame-ancestors to prevent clickjacking
```

**Example Header:**
```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "img-src 'self' https://steamcdn-a.akamaihd.net https://community.cloudflare.steamstatic.com; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "frame-ancestors 'none';"
  );
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});
```

---

### 8. **Audit Logging**
**Action Items:**
```typescript
- [ ] Create audit_logs table:
      - user_steam_id
      - action (enum: 'offer_created', 'trade_request', 'profile_updated', etc.)
      - resource_id
      - ip_address
      - user_agent
      - metadata (JSONB)
      - created_at
- [ ] Log sensitive operations:
      - Profile changes (trade URL updates)
      - Offer creation/deletion
      - Trade requests
      - Reputation votes
- [ ] Add audit log viewing for users (transparency)
- [ ] Retention policy (keep 90 days)
```

---

### 9. **Frontend Input Validation**
**Status:** Backend validation exists, need frontend validation too

**Action Items:**
```typescript
- [ ] Add Zod validation to all forms before API calls
- [ ] Validate item names (no scripts, no excessive length)
- [ ] Validate trade URLs client-side (UX improvement)
- [ ] Sanitize user-generated content before rendering
- [ ] Use DOMPurify for rich text (if adding later)
- [ ] Escape all user content in JSX (React does this by default)
```

---

### 10. **Trade URL Verification**
**Current Risk:** Users can submit fake trade URLs

**Action Items:**
```typescript
- [ ] Extract partner ID from trade URL
- [ ] Verify partner ID matches Steam ID
- [ ] Call Steam API to verify trade URL is valid
- [ ] Reject mismatched trade URLs
- [ ] Add warning if trade URL seems suspicious
```

---

### 11. **HTTPS Enforcement**
**Action Items:**
```typescript
- [ ] Ensure HTTPS in production (Supabase handles this)
- [ ] Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains
- [ ] Redirect HTTP to HTTPS in frontend routing
- [ ] Use secure cookies for any future cookie implementation
```

---

### 12. **Reputation System Abuse Prevention**
**Current Risk:** Vote manipulation, sock puppet accounts

**Action Items:**
```typescript
- [ ] Require minimum account age to vote (e.g., 7 days)
- [ ] Require minimum offers created to vote (e.g., 1)
- [ ] Rate limit votes (already planned: 50/day)
- [ ] Detect voting patterns (same user always voting for same target)
- [ ] Add "report abuse" feature
- [ ] Manual review for suspicious patterns
- [ ] Consider requiring completed trade request to vote
```

---

## 📊 **MONITORING & MAINTENANCE (Phase 4)**

### 13. **Error Monitoring**
**Action Items:**
```typescript
- [ ] Set up Sentry or similar error tracking
- [ ] Track API error rates
- [ ] Alert on unusual error spikes
- [ ] Monitor 500 errors separately
- [ ] Track rate limit hits
```

---

### 14. **Security Monitoring**
**Action Items:**
```typescript
- [ ] Monitor failed login attempts (implement after session migration)
- [ ] Track unusual API usage patterns
- [ ] Alert on:
      - Multiple failed auth attempts from same IP
      - Rapid offer creation (abuse)
      - Excessive API calls (DoS attempt)
      - Database errors (possible injection attempt)
- [ ] Weekly security audit log review
```

---

### 15. **Database Backups**
**Action Items:**
```typescript
- [ ] Enable Supabase automatic backups (daily)
- [ ] Test restore procedure
- [ ] Keep 30-day backup retention
- [ ] Export critical data weekly to separate storage
- [ ] Document disaster recovery plan
```

---

### 16. **Automated Security Testing**
**Action Items:**
```typescript
- [ ] Set up OWASP ZAP or Burp Suite scans
- [ ] Run security tests in CI/CD pipeline
- [ ] Perform penetration testing before launch
- [ ] Test for:
      - SQL injection (should fail - using Supabase)
      - XSS (test sanitization)
      - CSRF (test CORS)
      - Rate limiting bypasses
      - Session hijacking
      - Authorization bypasses
```

---

## 🎯 **NICE TO HAVE (Phase 5)**

### 17. **Two-Factor Authentication (2FA)**
- [ ] Require 2FA for high-value trades
- [ ] TOTP implementation
- [ ] Backup codes

### 18. **IP Reputation & Blocking**
- [ ] Block known VPN/proxy IPs (optional - may affect legitimate users)
- [ ] GeoIP blocking for high-risk regions (optional)
- [ ] Track IP reputation scores

### 19. **Advanced DDoS Protection**
- [ ] Cloudflare or similar CDN
- [ ] Rate limiting at CDN level
- [ ] Bot detection

### 20. **Compliance & Legal**
- [ ] Privacy policy
- [ ] Terms of service
- [ ] GDPR compliance (if EU users)
- [ ] Data deletion endpoint (GDPR right to be forgotten)
- [ ] Cookie consent banner
- [ ] Age verification (Steam already handles this)

---

## 📋 **RECOMMENDED PRIORITY ORDER**

### Week 1 (Critical):
1. ✅ Rate limiting implementation
2. ✅ CORS security fix
3. ✅ Error handling cleanup
4. ✅ Environment variable validation

### Week 2 (High Priority):
5. ✅ Session security migration
6. ✅ Content Security Policy headers
7. ✅ Audit logging setup

### Week 3 (Important):
8. ✅ Trade URL verification
9. ✅ Frontend validation
10. ✅ Reputation abuse prevention

### Week 4 (Maintenance):
11. ✅ Error monitoring setup
12. ✅ Security monitoring
13. ✅ Database backup testing
14. ✅ Penetration testing

---

## 🔥 **IMMEDIATE ACTION - START WITH THESE 3**

### 1️⃣ Rate Limiting (Blocks API abuse)
- Prevents spam, DoS, reputation manipulation
- Uses existing rate_limits table
- 2-3 hours to implement

### 2️⃣ CORS Security (Blocks unauthorized access)
- Prevents CSRF attacks
- One-line fix in index.tsx
- 15 minutes to implement

### 3️⃣ Error Handling (Prevents info leakage)
- Stops attackers from learning your database schema
- Replace all exposed error details
- 1-2 hours to implement

---

## 📞 **Questions to Answer Before Launch**

1. **What's your domain?** (for CORS allowlist)
2. **Do you have a staging environment?** (for testing security changes)
3. **What's your expected traffic?** (for rate limit tuning)
4. **Will you support EU users?** (GDPR implications)
5. **Do you have error monitoring set up?** (Sentry, etc.)
6. **Have you tested the app with malicious inputs?** (XSS, injection attempts)
7. **Do you have a disaster recovery plan?** (backup restore procedure)

---

## ✅ **You're Already Ahead!**

Your Phase 1 migration was excellent:
- ✅ Proper database schema
- ✅ RLS enabled (critical!)
- ✅ Input validation
- ✅ Sanitization
- ✅ Foreign key constraints
- ✅ No raw SQL (using Supabase client)

You just need to close the remaining security gaps! 🚀
