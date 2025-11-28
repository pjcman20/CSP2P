# 🚀 Figma Make → Cursor Migration Checklist

Use this checklist to ensure a smooth transition to Cursor IDE.

---

## ✅ Pre-Migration (Do This First)

- [ ] Read `/CURSOR_SETUP.md` fully
- [ ] Create Supabase account and project
- [ ] Get Steam API key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
- [ ] Have Node.js 18+ installed

---

## 🔧 Initial Setup

- [ ] Extract project ZIP to local folder
- [ ] Open folder in Cursor IDE
- [ ] Run `npm install`
- [ ] Create `.env.local` file (copy from `.env.example`)
- [ ] Fill in all environment variables
- [ ] Install Supabase CLI: `npm install -g supabase`

---

## 🗄️ Database Setup

- [ ] Link Supabase project: `supabase link --project-ref YOUR_REF`
- [ ] Push migrations: `supabase db push`
- [ ] Verify tables in Supabase Dashboard > Table Editor
  - [ ] users
  - [ ] offers
  - [ ] trade_requests
  - [ ] user_reputation
  - [ ] inventory_cache
  - [ ] steam_auth_tokens
  - [ ] notifications
  - [ ] kv_store_e2cf3727

---

## ☁️ Backend Deployment

- [ ] Deploy Edge Function: `supabase functions deploy make-server-e2cf3727 --no-verify-jwt`
- [ ] Set function secrets:
  ```bash
  supabase secrets set STEAM_API_KEY=your_key
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
  ```
- [ ] Test function in Supabase Dashboard > Edge Functions > Logs

---

## 🔐 Authentication Setup

- [ ] Enable Steam provider in Supabase Dashboard > Authentication > Providers
- [ ] Set redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
- [ ] Test Steam login flow

---

## 🖼️ Asset Migration (CRITICAL!)

### Figma Assets to Replace

These files have `figma:asset` imports that won't work locally:

#### `/components/CreateOfferModal.tsx`
- [ ] Line 10-12: `anyKnifeImg`, `anyOffersImg`, `anyCasesImg`
  - **Option A**: Extract from Figma, save to `/public/assets/`
  - **Option B**: Use placeholder URLs

#### `/components/OfferCard.tsx`
- [ ] Line 5-7: Same placeholder images
  - Already imported, just need the actual files

#### `/components/Dashboard.tsx`
- [ ] Check for any Figma asset imports
  - Update if found

### SVG Imports (Should Work As-Is)

These should work without changes:
- `/imports/svg-*.tsx` files

---

## 📝 Code Updates

### Update `/utils/supabase/info.tsx`

```typescript
// BEFORE (Figma Make):
export const projectId = 'hardcoded-id';
export const publicAnonKey = 'hardcoded-key';

// AFTER (Cursor):
export const projectId = import.meta.env.VITE_SUPABASE_URL
  ?.split('//')[1]?.split('.')[0] || 'fallback-id';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
```

- [ ] Update this file

### Clean Up Debug Logs

Search and remove/comment out debug logs:
- [ ] `console.log('📤 FRONTEND: Sending offer to server:'` in `/utils/offerApi.ts`
- [ ] `console.log('💾 Saving offer with items:'` in `/supabase/functions/server/index.tsx`
- [ ] Any other debug logs you added

---

## 🧪 Testing

### Test Each Feature

- [ ] **Homepage loads** (no errors in console)
- [ ] **Steam login works** (redirects to Steam, returns with user data)
- [ ] **Create offer** (with real items and placeholders)
- [ ] **View offer** (images load correctly)
- [ ] **Send trade request** (appears in recipient's dashboard)
- [ ] **Inventory loads** (from Steam API)
- [ ] **Search/filter** (basic functionality works)
- [ ] **User dashboard** (shows user's offers)

### Check Logs

- [ ] Browser console (no errors)
- [ ] Supabase Edge Function logs (no 500 errors)
- [ ] Network tab (API calls succeed)

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot find module 'figma:asset'"
**Fix**: Replace Figma asset imports (see Asset Migration section)

### Issue: "Cannot connect to Supabase"
**Fix**: 
- Check `.env.local` exists in project root
- Restart dev server: `npm run dev`
- Verify environment variables are correct

### Issue: "Edge Function returns 500"
**Fix**:
- Check function logs in Supabase Dashboard
- Verify secrets are set: `supabase secrets list`
- Redeploy: `supabase functions deploy make-server-e2cf3727`

### Issue: "Steam login fails"
**Fix**:
- Verify Steam provider is enabled
- Check redirect URL matches exactly
- Clear browser cache

### Issue: "Images not loading"
**Fix**:
- Extract Figma assets to `/public/assets/`
- Update imports to use local paths
- Or use placeholder URLs temporarily

---

## 🎯 Post-Migration

### Optimize for Production

- [ ] Remove all debug logs
- [ ] Add proper error handling
- [ ] Test on different browsers
- [ ] Test mobile responsive design
- [ ] Check CORS headers
- [ ] Review RLS policies
- [ ] Add rate limiting (see `/SECURITY_ROADMAP.md`)

### Deploy to Production

- [ ] Build: `npm run build`
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Ensure Edge Functions are deployed
- [ ] Update environment variables in hosting platform
- [ ] Test production deployment

---

## 📚 Reference

- **Setup Guide**: `/CURSOR_SETUP.md`
- **Export Guide**: `/EXPORT_GUIDE.md`
- **Security**: `/SECURITY_ROADMAP.md`
- **README**: `/README.md`

---

## ✨ You're Done!

Once all checkboxes are ticked, your CS Trading Hub is ready for development in Cursor! 🎮

**Next Steps:**
1. Fix any remaining placeholder issues
2. Add new features
3. Improve UI/UX
4. Test thoroughly
5. Deploy to production

Good luck! 🚀
