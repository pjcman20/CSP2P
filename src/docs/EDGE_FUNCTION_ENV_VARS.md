# Edge Function Environment Variables

## Required Environment Variables

The Edge Function `make-server-e2cf3727` requires the following environment variables:

### Required for Basic Operation

1. **SUPABASE_URL**
   - Your Supabase project URL
   - Format: `https://<project-ref>.supabase.co`
   - Found in: Supabase Dashboard > Settings > API > Project URL

2. **SUPABASE_SERVICE_ROLE_KEY**
   - Service role key (has admin privileges)
   - Found in: Supabase Dashboard > Settings > API > service_role key
   - ⚠️ Keep this secret! Never expose in frontend code

3. **STEAM_API_KEY**
   - Your Steam Web API key
   - Get from: https://steamcommunity.com/dev/apikey

### Required for Authentication Token Generation

4. **SUPABASE_ANON_KEY**
   - Anon/public key (safe to expose in frontend)
   - Found in: Supabase Dashboard > Settings > API > anon public key
   - **Required for Steam authentication token generation**
   - Used for password-based sign-in to generate JWT tokens

## Setting Environment Variables

### Using Supabase CLI

```bash
# Set environment variable for a specific function
supabase secrets set SUPABASE_ANON_KEY=your-anon-key --project-ref fjouoltxkrdoxznodqzb

# Set all required variables
supabase secrets set \
  SUPABASE_URL=https://fjouoltxkrdoxznodqzb.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  SUPABASE_ANON_KEY=your-anon-key \
  STEAM_API_KEY=your-steam-api-key \
  --project-ref fjouoltxkrdoxznodqzb
```

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to: **Edge Functions** > **make-server-e2cf3727**
3. Click **Settings** tab
4. Add environment variables in the **Secrets** section

### For Local Development

Create a `.env` file in `supabase/functions/make-server-e2cf3727/`:

```env
SUPABASE_URL=https://fjouoltxkrdoxznodqzb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
STEAM_API_KEY=your-steam-api-key
```

Then run:
```bash
supabase functions serve make-server-e2cf3727 --env-file supabase/functions/make-server-e2cf3727/.env
```

## Troubleshooting

### Error: "SUPABASE_ANON_KEY environment variable not set"

**Solution**: Set the `SUPABASE_ANON_KEY` environment variable using one of the methods above.

**Why it's needed**: The Edge Function uses password-based authentication to generate JWT tokens for Steam users. This requires the anon key (not the service role key) to sign in users.

### Error: "Invalid token response from Supabase Auth"

**Possible causes**:
1. `SUPABASE_ANON_KEY` is incorrect or missing
2. Email auth provider is disabled in Supabase
3. User creation failed

**Solution**:
1. Verify `SUPABASE_ANON_KEY` is set correctly
2. Check Supabase Dashboard > Authentication > Providers > Email (should be enabled)
3. Check Edge Function logs for detailed error messages

## Security Notes

- ✅ `SUPABASE_ANON_KEY` is safe to use in Edge Functions (it's designed to be public)
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` must be kept secret (never expose in frontend)
- ✅ Environment variables in Edge Functions are encrypted at rest
- ✅ Only accessible within the Edge Function runtime

