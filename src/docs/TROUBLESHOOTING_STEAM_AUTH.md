# Troubleshooting Steam Authentication

## Common Issues and Solutions

### Issue: "Authentication failed" or "Invalid response from server"

**Step 1: Check Browser Console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try signing in with Steam
4. Look for error messages - they will show the exact issue

**Step 2: Check Edge Function Logs**
1. Go to Supabase Dashboard
2. Navigate to: Edge Functions → make-server-e2cf3727 → Logs
3. Look for errors during authentication attempt

**Step 3: Verify Environment Variables**
Check that all secrets are set:
```bash
supabase secrets list --project-ref fjouoltxkrdoxznodqzb
```

Should show:
- `ANON_KEY` ✅
- `STEAM_API_KEY` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `SUPABASE_URL` ✅

**Step 4: Verify Email Auth is Enabled**
1. Go to Supabase Dashboard
2. Navigate to: Authentication → Providers → Email
3. Ensure "Enable Email Provider" is ON
4. This is required for password-based token generation

**Step 5: Check Database Logs**
1. Go to Supabase Dashboard
2. Navigate to: Logs → Database
3. Look for errors related to `auth.users` table

## Common Error Messages

### "ANON_KEY not found"
**Solution**: Set the secret:
```bash
supabase secrets set ANON_KEY=your-anon-key --project-ref fjouoltxkrdoxznodqzb
```

### "Sign-in failed: Invalid login credentials"
**Possible causes**:
1. Email auth provider disabled
2. User creation failed
3. Password setting failed

**Solution**: 
- Enable email auth provider in Supabase Dashboard
- Check Edge Function logs for detailed error

### "Failed to fetch user profile"
**Solution**: Verify `STEAM_API_KEY` is set correctly

### "Steam authentication failed"
**Solution**: 
- Check Steam API key is valid
- Verify Steam OpenID verification is working
- Check Edge Function logs

## Debug Mode

To get more detailed logs, the Edge Function now includes extensive logging. Check:
1. Browser console (frontend errors)
2. Supabase Dashboard → Edge Functions → Logs (backend errors)
3. Network tab in DevTools (API response details)

## Still Having Issues?

1. Check all environment variables are set
2. Verify email auth provider is enabled
3. Check Edge Function logs for specific error messages
4. Ensure Steam API key is valid
5. Try creating a test user manually to verify database setup

