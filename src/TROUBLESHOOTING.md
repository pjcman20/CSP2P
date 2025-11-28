# 🔧 CS Trading Hub - Troubleshooting Guide

Quick fixes for common issues when migrating to Cursor IDE.

---

## 🚨 Cannot Start Dev Server

### Error: "Module not found"
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Error: "Port 5173 already in use"
```bash
# Kill the process using the port
# macOS/Linux:
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID [PID_NUMBER] /F

# Or change port in vite.config.ts
```

---

## 🔐 Authentication Issues

### Steam Login Redirects but Doesn't Work

**Symptoms**: After Steam login, redirects back but not authenticated

**Check:**
1. Steam provider enabled in Supabase? (Auth > Providers > Steam)
2. Redirect URL correct? Should be: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. Environment variables set? Check `.env.local` has correct values

**Fix:**
```bash
# Verify .env.local
cat .env.local

# Should show:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# Restart dev server
npm run dev
```

### Error: "Not authenticated" when creating offers

**Symptoms**: Can login but can't create offers

**Check:**
```typescript
// In browser console:
localStorage.getItem('steam_session_id')
// Should return a session ID
```

**Fix:**
- Clear localStorage: `localStorage.clear()`
- Re-login with Steam
- Check Edge Function logs for auth errors

---

## 🖼️ Images Not Loading

### Placeholder Images Show as Broken

**Symptoms**: "Any Knife", "Any Offers", "Any Cases" don't show images

**Root Cause**: `figma:asset` imports don't work in local environment

**Fix Option 1 - Use Local Assets:**
```typescript
// In /components/CreateOfferModal.tsx and /components/OfferCard.tsx

// BEFORE:
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';

// AFTER:
import anyKnifeImg from '/assets/any-knife.png';
```

Then add image files to `/public/assets/` directory.

**Fix Option 2 - Use Placeholder URLs:**
```typescript
// Quick temporary fix
const anyKnifeImg = 'https://images.unsplash.com/photo-1611329857570-f02f340e7378?w=400';
const anyOffersImg = 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400';
const anyCasesImg = 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400';
```

### User Avatars Not Loading

**Check:**
- Are users logged in via Steam?
- Does Steam profile have an avatar?
- Check browser console for CORS errors

**Fix:**
- Steam avatars should work automatically
- Check `users` table in Supabase has `avatar_url` populated

---

## 🔌 API / Backend Issues

### Edge Function Returns 500 Error

**Symptoms**: API calls fail with 500 Internal Server Error

**Check Logs:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions > make-server-e2cf3727 > Logs
3. Look for error messages

**Common Causes:**

#### 1. Missing Environment Variables
```bash
# Check secrets are set
supabase secrets list

# Should show:
# - STEAM_API_KEY
# - SUPABASE_SERVICE_ROLE_KEY

# If missing, set them:
supabase secrets set STEAM_API_KEY=your_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
```

#### 2. Database Connection Issues
- Check `SUPABASE_DB_URL` is correct in function environment
- Verify database is accessible (not paused)

#### 3. Code Errors
- Check function logs for stack traces
- Fix errors in `/supabase/functions/server/` files
- Redeploy: `supabase functions deploy make-server-e2cf3727`

### Error: "Failed to create offer"

**Symptoms**: Create offer modal submits but shows error

**Debug Steps:**
1. Open browser DevTools > Network tab
2. Find the `POST /offers/create` request
3. Check response for error message

**Common Fixes:**

#### RLS Policy Blocking Insert
```sql
-- In Supabase SQL Editor, verify policy exists:
SELECT * FROM pg_policies WHERE tablename = 'offers';

-- Should have INSERT policy for authenticated users
-- If missing, run migration again:
-- supabase db push
```

#### Invalid Session
```typescript
// In browser console:
localStorage.getItem('steam_session_id')

// If null or undefined:
localStorage.clear();
// Then re-login
```

---

## 🗄️ Database Issues

### Error: "relation does not exist"

**Symptoms**: Database queries fail with table not found

**Fix:**
```bash
# Push migrations to create tables
supabase link --project-ref YOUR_REF
supabase db push

# Verify tables exist in Supabase Dashboard > Table Editor
```

### RLS Policy Blocks Valid Operations

**Symptoms**: Can't read/write data even when authenticated

**Debug:**
```sql
-- In Supabase SQL Editor
-- Check which policies exist:
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public';

-- Test if you can insert manually:
INSERT INTO offers (user_steam_id, offering, seeking, status)
VALUES ('your_steam_id', '[]', '[]', 'active');
```

**Fix:**
- Run migrations again: `supabase db push`
- Check Edge Function is using correct auth headers
- Verify session is valid in `steam_auth_tokens` table

---

## 🔍 Search/Filter Not Working

### Search Returns No Results

**Check:**
- Is search implemented in backend?
- Are you searching the right fields?

**Currently:** Search is basic and only filters by user name. Advanced search not yet implemented.

**To Add Advanced Search:**
Edit `/supabase/functions/server/index.tsx`:
```typescript
// Add query parameters to /offers/list endpoint
const search = url.searchParams.get('search');
const category = url.searchParams.get('category');

// Then filter in database query
```

---

## 📱 Mobile/Responsive Issues

### Layout Broken on Mobile

**Check:**
- Tailwind responsive classes (`md:`, `lg:`) applied?
- Viewport meta tag in `index.html`?

**Fix:**
```html
<!-- In index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

---

## 🐌 Performance Issues

### Page Loads Slowly

**Common Causes:**
1. Too many API calls
2. Large images not optimized
3. No caching

**Fixes:**
```typescript
// 1. Reduce polling frequency
// In MarketplaceFeed.tsx:
const POLL_INTERVAL = 10000; // 10 seconds instead of 5

// 2. Add image lazy loading
<img loading="lazy" src={...} />

// 3. Cache API responses
// Use React Query or SWR (not yet implemented)
```

---

## 🔄 Real-time Updates Not Working

### New Offers Don't Appear

**Check:**
- Is polling enabled? (Should be by default)
- Check browser console for errors
- Verify `/offers/list` endpoint works

**Debug:**
```typescript
// In MarketplaceFeed.tsx, add console.log:
useEffect(() => {
  const interval = setInterval(async () => {
    console.log('Polling for new offers...');
    const newOffers = await getAllOffers();
    console.log('Fetched offers:', newOffers.length);
    setOffers(newOffers);
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

---

## 💾 Data Not Saving

### Changes Don't Persist

**Check:**
1. Network tab shows successful API call (200 status)?
2. Database shows updated data?
3. Frontend updates local state?

**Debug:**
```typescript
// Add logging to API calls
// In /utils/offerApi.ts:
export async function createOffer(...) {
  console.log('Creating offer:', { offering, seeking, notes });
  const response = await fetch(...);
  console.log('Response:', response.status);
  const data = await response.json();
  console.log('Created offer:', data);
  return data.offer;
}
```

---

## 🧹 Clean Slate Reset

### Start Fresh (Nuclear Option)

If everything is broken:

```bash
# 1. Clear local storage
# In browser console:
localStorage.clear();
sessionStorage.clear();

# 2. Delete node_modules
rm -rf node_modules package-lock.json

# 3. Reinstall dependencies
npm install

# 4. Reset Supabase connection
supabase link --project-ref YOUR_REF

# 5. Re-run migrations
supabase db push

# 6. Redeploy functions
supabase functions deploy make-server-e2cf3727

# 7. Restart dev server
npm run dev
```

---

## 📞 Still Stuck?

### Debugging Checklist

- [ ] Browser console shows no errors?
- [ ] Network tab shows successful API calls?
- [ ] Supabase Edge Function logs show no errors?
- [ ] Database tables exist and have data?
- [ ] Environment variables are correct?
- [ ] Steam login works?
- [ ] All migrations applied?

### Get Help

1. **Check logs in order:**
   - Browser DevTools Console
   - Browser DevTools Network tab
   - Supabase Dashboard > Edge Functions > Logs
   - Supabase Dashboard > Database > Query Performance

2. **Document the issue:**
   - What did you do?
   - What did you expect?
   - What actually happened?
   - Error messages (full text)
   - Screenshots if UI issue

3. **Search documentation:**
   - `/EXPORT_GUIDE.md`
   - `/CURSOR_SETUP.md`
   - `/ARCHITECTURE.md`
   - `/SECURITY_ROADMAP.md`

---

## 🎯 Quick Reference

### Most Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Can't login | Check Steam provider enabled, clear localStorage |
| Images broken | Replace `figma:asset` imports with local files |
| API 500 error | Check Edge Function logs, verify secrets set |
| Table not found | Run `supabase db push` |
| Not authenticated | Clear localStorage, re-login |
| Port in use | Kill process: `lsof -ti:5173 \| xargs kill -9` |

### Useful Commands

```bash
# Development
npm run dev                                          # Start dev server
supabase functions serve                            # Local edge function

# Deployment  
npm run build                                       # Build frontend
supabase functions deploy make-server-e2cf3727      # Deploy backend
supabase db push                                    # Apply migrations

# Debugging
supabase functions logs make-server-e2cf3727        # View logs
supabase db diff                                    # Check schema changes
supabase secrets list                               # View set secrets
```

---

Good luck! 🍀 If you're still stuck after trying everything, create a detailed issue report with logs and screenshots.
