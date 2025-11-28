# CS Trading Hub - Export Guide for Cursor IDE

## 📦 What You're Exporting

This is a **Counter-Strike skin trading discovery platform** built with:
- **Frontend**: React + TypeScript + Tailwind CSS v4
- **Backend**: Supabase Edge Functions (Deno) + Hono web server
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Steam OAuth via Supabase Auth
- **Storage**: Supabase Storage for user-generated content

---

## 🚀 Quick Start in Cursor

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

You need a Supabase project. Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Configure Environment Variables

Create a `.env.local` file in the root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=your_supabase_postgres_connection_string

# Steam API
STEAM_API_KEY=your_steam_api_key
```

**Where to find these:**
- Supabase URL/Keys: Project Settings > API in Supabase Dashboard
- Steam API Key: [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)

### 4. Update Supabase Info File

Edit `/utils/supabase/info.tsx` to use environment variables:

```typescript
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'your-project-id';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
```

### 5. Set Up Database Schema

Run the migrations in `/supabase/migrations/` directory. You can use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Or manually** copy the SQL from migration files and run in Supabase SQL Editor.

### 6. Deploy Edge Functions

```bash
# Deploy the server edge function
supabase functions deploy make-server-e2cf3727 --project-ref your-project-ref
```

### 7. Configure Steam OAuth

Follow Supabase docs for Steam OAuth:
[https://supabase.com/docs/guides/auth/social-login/auth-steam](https://supabase.com/docs/guides/auth/social-login/auth-steam)

You'll need to:
1. Register your app with Steam
2. Add Steam provider in Supabase Auth settings
3. Configure redirect URLs

### 8. Run Development Server

```bash
npm run dev
```

---

## 📂 Project Structure

```
/
├── App.tsx                          # Main React component
├── components/                      # React components
│   ├── MarketplaceFeed.tsx         # Homepage feed
│   ├── CreateOfferModal.tsx        # Offer creation
│   ├── OfferCard.tsx               # Trade offer cards
│   ├── Dashboard.tsx               # User dashboard
│   └── ui/                         # Reusable UI components
├── utils/                          # Utilities
│   ├── steamAuth.ts                # Steam OAuth logic
│   ├── offerApi.ts                 # API calls to backend
│   └── supabase/                   # Supabase client setup
├── supabase/
│   ├── functions/server/           # Edge Function backend
│   │   ├── index.tsx              # Hono web server
│   │   ├── db.tsx                 # Database functions
│   │   └── kv_store.tsx           # Key-value store
│   └── migrations/                 # Database migrations
├── imports/                        # Figma-imported SVGs
└── styles/
    └── globals.css                 # Global styles + Tailwind config
```

---

## 🔑 Key Features to Know

### 1. **Database Tables** (see `SECURITY_ROADMAP.md`)
- `users` - Steam user profiles
- `offers` - Trade offers (offering/seeking items)
- `trade_requests` - Request to trade
- `user_reputation` - Community ratings
- `inventory_cache` - Cached Steam inventories
- `steam_auth_tokens` - OAuth sessions
- `notifications` - User notifications
- `kv_store_e2cf3727` - Generic key-value storage

### 2. **Placeholder Items**
Items like "Any Knife", "Any Offers", "Any Cases" are placeholders detected by name in `OfferCard.tsx`.

### 3. **Steam Inventory Integration**
- Uses Steam Web API to fetch user inventories
- Cached in `inventory_cache` table
- See `/supabase/functions/server/steam.tsx`

### 4. **Real-time Updates**
- Polling-based updates (every 5 seconds)
- See `/utils/pollingSubscription.ts`
- Can switch to Supabase Realtime if needed

---

## 🐛 Known Issues to Fix

### Critical:
1. **Placeholder images not loading** - Fixed in `OfferCard.tsx` but needs testing
2. **Console logs need cleanup** - Remove debug logs before production

### Medium Priority:
- Trade execution flow incomplete
- Notification system not fully implemented
- Search/filter functionality basic

See `/SECURITY_ROADMAP.md` for full security checklist.

---

## 🔧 Development Tips

### Running Edge Functions Locally

```bash
supabase functions serve make-server-e2cf3727 --env-file .env.local
```

### Testing Database Queries

Use Supabase SQL Editor or connect via psql:

```bash
psql "your_supabase_postgres_connection_string"
```

### Debugging Edge Functions

Check logs in Supabase Dashboard > Edge Functions > Logs

### Hot Module Replacement

Vite's HMR should work out of the box. If components don't update, restart dev server.

---

## 📦 Figma-Specific Assets

**Important:** This project has Figma-imported assets at:
- `/imports/svg-*.tsx` - SVG components
- `figma:asset/*` - Image imports

In a local environment, you'll need to:
1. **Replace Figma asset imports** with regular imports:
   ```typescript
   // Before (Figma Make):
   import img from "figma:asset/03d9db583e449a92fde00c448df118b1af8d15e8.png";
   
   // After (Local):
   import img from "./assets/any-knife.png";
   ```

2. **Copy images** from Figma or use placeholder URLs

3. **SVG imports** should work as-is if using Vite

---

## 🎨 Design System

CS2-inspired color palette in `/styles/globals.css`:
- **Primary Orange**: #FF6A00
- **Electric Blue**: #00D9FF
- **Dark Background**: #1B2838
- **Deep Background**: #0f1419

Typography:
- System font stack for performance
- Custom monospace for float values

---

## 🚢 Deployment

### Frontend (Vercel/Netlify)
1. Build: `npm run build`
2. Deploy `dist/` directory
3. Set environment variables in platform settings

### Backend (Supabase Edge Functions)
Already hosted on Supabase - just deploy functions:
```bash
supabase functions deploy make-server-e2cf3727
```

### Database Migrations
Run new migrations:
```bash
supabase db push
```

---

## 📞 Support

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Steam API Docs**: [steamcommunity.com/dev](https://steamcommunity.com/dev)
- **Security Roadmap**: See `/SECURITY_ROADMAP.md`

---

## ⚠️ Important Notes

1. **Never commit `.env.local`** - Already in `.gitignore`
2. **Service Role Key is sensitive** - Only use server-side
3. **Steam API has rate limits** - Implement caching (already done)
4. **RLS policies are critical** - Test thoroughly before production
5. **Trade URLs are user-provided** - Validate format

---

Good luck building CS Trading Hub in Cursor! 🎮🔧
