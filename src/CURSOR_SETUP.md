# 🎯 Setting Up CS Trading Hub in Cursor IDE

This guide walks you through setting up the project in Cursor step-by-step.

---

## Step 1: Export from Figma Make

1. **Download the project** from Figma Make
2. **Extract** the ZIP file to your desired location
3. **Open in Cursor**: `File > Open Folder` and select the extracted directory

---

## Step 2: Install Node.js & Dependencies

### Check Node.js Version
```bash
node --version  # Should be 18.x or higher
```

If you need to install Node.js: [nodejs.org](https://nodejs.org/)

### Install Dependencies
```bash
npm install
```

This installs all React, Vite, and Tailwind dependencies.

---

## Step 3: Set Up Supabase

### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name**: CS Trading Hub
   - **Database Password**: (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to provision (~2 minutes)

### Get Your API Keys

1. In Supabase Dashboard: **Settings > API**
2. Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key)
   - **service_role key** (keep this secret!)

3. Go to **Settings > Database**
4. Copy:
   - **Connection String** (URI format)

---

## Step 4: Configure Environment Variables

### Create `.env.local` File

In the project root, create `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:5432/postgres
STEAM_API_KEY=your_steam_key_here
```

**Replace:**
- `xxxxx` with your actual project ID
- The keys with your actual keys
- `[password]` and `[host]` in the DB URL
- `your_steam_key_here` with your Steam API key (get from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey))

### Update Supabase Info File

Edit `/utils/supabase/info.tsx`:

```typescript
// Replace the hardcoded values with environment variables
export const projectId = import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'fallback-id';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'fallback-key';
```

---

## Step 5: Set Up Database Schema

### Install Supabase CLI

```bash
npm install -g supabase
```

### Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref:** In Supabase Dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### Run Migrations

```bash
supabase db push
```

This creates all 8 production-ready tables with RLS policies.

**Or manually:** Copy SQL from each file in `/supabase/migrations/` and run in Supabase SQL Editor.

---

## Step 6: Deploy Edge Functions

### Navigate to Functions Directory

```bash
cd supabase/functions/server
```

### Deploy the Server Function

```bash
supabase functions deploy make-server-e2cf3727 --no-verify-jwt
```

**Set Environment Variables for Edge Function:**

```bash
supabase secrets set STEAM_API_KEY=your_steam_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Step 7: Configure Steam OAuth

### Get Steam OpenID Credentials

1. Go to [steamcommunity.com](https://steamcommunity.com)
2. You don't need to register - Steam uses OpenID
3. Just configure the return URL in Supabase

### Configure in Supabase

1. In Supabase Dashboard: **Authentication > Providers**
2. Find **Steam** and enable it
3. Set **Redirect URL**:
   ```
   https://YOUR_PROJECT.supabase.co/auth/v1/callback
   ```
4. Save changes

---

## Step 8: Fix Figma Asset Imports (Important!)

Figma Make uses special `figma:asset` imports that won't work in a local environment.

### Find All Figma Assets

Search for: `figma:asset`

You'll find imports like:
```typescript
import anyKnifeImg from 'figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png';
```

### Option A: Extract Assets (Recommended)

1. In Figma Make, right-click each image
2. Save to `/public/assets/` folder
3. Update imports:
   ```typescript
   import anyKnifeImg from '/assets/any-knife.png';
   ```

### Option B: Use Placeholder URLs

Replace with Unsplash/placeholder images:
```typescript
const anyKnifeImg = 'https://images.unsplash.com/photo-1611329857570-f02f340e7378?w=400';
```

### Files to Check:
- `/components/CreateOfferModal.tsx`
- `/components/OfferCard.tsx`
- `/components/Dashboard.tsx`

---

## Step 9: Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

You should see the CS Trading Hub homepage! 🎮

---

## Step 10: Test Core Features

### Test Steam Login
1. Click **"Sign in with Steam"**
2. Should redirect to Steam OpenID
3. After login, should return to app with user info

### Test Offer Creation
1. Click **"Create Offer"**
2. Add items (or placeholders)
3. Submit offer
4. Check Supabase Dashboard > Table Editor > `offers` table

### Check Edge Function Logs
In Supabase Dashboard: **Edge Functions > make-server-e2cf3727 > Logs**

Look for:
- `💾 Saving offer with items:`
- `✅ Offer created successfully`

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
npm install
npm run dev
```

### "Cannot connect to Supabase"
- Check `.env.local` is in project root
- Verify VITE_SUPABASE_URL and keys are correct
- Restart dev server after changing .env

### Edge Function not working
```bash
# Check function logs in Supabase Dashboard
# Redeploy if needed:
supabase functions deploy make-server-e2cf3727
```

### Steam OAuth fails
- Verify redirect URL matches exactly
- Check Steam provider is enabled in Supabase
- Clear browser cache and try again

### Database queries fail
- Check RLS policies are enabled
- Verify user is authenticated
- Check Edge Function logs for SQL errors

### Images not loading
- Extract Figma assets (see Step 8)
- Or use placeholder URLs
- Check browser console for 404 errors

---

## 🎯 Next Steps

Once everything is running:

1. **Remove debug logs** - Clean up console.log statements
2. **Test all features** - Create offers, send trade requests, etc.
3. **Add error handling** - Improve user-facing error messages
4. **Optimize performance** - Add loading states, optimize queries
5. **Deploy to production** - See `/EXPORT_GUIDE.md` for deployment

---

## 📚 Helpful Resources

- **Cursor AI Tips**: Use Cmd+K to ask Cursor for code changes
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Steam API Docs**: [steamcommunity.com/dev](https://steamcommunity.com/dev)
- **React Docs**: [react.dev](https://react.dev)
- **Tailwind Docs**: [tailwindcss.com](https://tailwindcss.com)

---

## 🎮 You're Ready!

Your CS Trading Hub is now running locally in Cursor. Time to build awesome features! 🚀

Questions? Check `/EXPORT_GUIDE.md` or the main `/README.md`.
