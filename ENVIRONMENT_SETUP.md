# Environment Setup - Separating Localhost from Figma Make

## Overview

This guide helps you set up separate environments so your **localhost development** doesn't conflict with your **Figma Make production site**.

## Option 1: Separate Supabase Projects (Recommended)

**Best for:** Complete isolation between development and production

### Steps:

1. **Create a new Supabase project for localhost:**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Name it something like "CS Trading Hub - Local Dev"
   - Copy the project ID and API keys

2. **Set up local environment variables:**
   ```bash
   # Copy the example file
   cp .env.local.example .env.local
   
   # Edit .env.local with your LOCAL project credentials
   VITE_SUPABASE_PROJECT_ID=your-local-project-id
   VITE_SUPABASE_URL=https://your-local-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-local-anon-key
   ```

3. **Set up Edge Function secrets for local project:**
   ```bash
   supabase secrets set \
     SUPABASE_URL=https://your-local-project-id.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key \
     ANON_KEY=your-local-anon-key \
     STEAM_API_KEY=your-steam-api-key \
     --project-ref your-local-project-id
   ```

4. **Deploy Edge Functions to local project:**
   ```bash
   supabase functions deploy make-server-e2cf3727 --project-ref your-local-project-id
   ```

5. **Run database migrations on local project:**
   ```bash
   # Link to local project
   supabase link --project-ref your-local-project-id
   
   # Push migrations
   supabase db push
   ```

## Option 2: Same Project, Different Schema (Advanced)

**Best for:** Sharing data but isolating development

This requires using database schemas or prefixes, which is more complex.

## Option 3: Same Project, Development Mode (Simplest)

**Best for:** Quick development, but be careful!

If you want to use the same Supabase project:

1. **Use environment variables to point to same project:**
   ```bash
   # .env.local
   VITE_SUPABASE_PROJECT_ID=fjouoltxkrdoxznodqzb
   VITE_SUPABASE_URL=https://fjouoltxkrdoxznodqzb.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Be careful:**
   - ⚠️ Both localhost and Figma Make will use the same database
   - ⚠️ Test data from localhost will appear in production
   - ⚠️ Production data will appear in localhost
   - ✅ Good for: Testing with real data, quick development

## Current Configuration

The code now reads from environment variables:
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID
- `VITE_SUPABASE_URL` - Your Supabase project URL  
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

If these aren't set, it falls back to the hardcoded values (your current Figma Make project).

## Figma Make Configuration

Your Figma Make site should use its own environment variables:
- Set these in Figma Make's environment settings
- They will point to your production Supabase project
- This keeps production separate from localhost

## Verification

To verify you're using the right environment:

1. **Check browser console:**
   - Look for Supabase URL in network requests
   - Should match your `.env.local` file

2. **Check Supabase Dashboard:**
   - Look at your project's logs
   - Should see requests from localhost (127.0.0.1) vs your Figma Make domain

3. **Test with dummy data:**
   - Create a test offer in localhost
   - Check if it appears in your Figma Make site
   - If it does, you're sharing the same database (Option 3)
   - If it doesn't, you're using separate projects (Option 1)

## Recommended Setup

**For development:** Use Option 1 (separate projects)
- Complete isolation
- Safe to test anything
- No risk to production data

**For quick testing:** Use Option 3 (same project)
- Faster setup
- Can test with real data
- But be careful not to break production!

## Next Steps

1. Choose your approach (Option 1 recommended)
2. Create `.env.local` file with your chosen configuration
3. Restart your dev server: `npm run dev`
4. Verify you're connecting to the right project

