# Testing Edge Function - Debugging "Shutdown" Issue

## Step 1: Test Health Check Endpoint

The function has a health check endpoint. Test it directly:

```bash
curl https://fjouoltxkrdoxznodqzb.supabase.co/functions/v1/make-server-e2cf3727/health
```

Or open in browser:
```
https://fjouoltxkrdoxznodqzb.supabase.co/functions/v1/make-server-e2cf3727/health
```

**Expected response:** `{"status":"ok"}`

If this doesn't work, the function isn't deployed correctly.

## Step 2: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try signing in with Steam
4. Look for request to: `make-server-e2cf3727/steam/callback`
5. Check:
   - Status code (should be 200 or 500, not 404)
   - Response body
   - Request URL

## Step 3: Check Function Deployment

Verify the function is actually deployed:

```bash
supabase functions list --project-ref fjouoltxkrdoxznodqzb
```

Should show: `make-server-e2cf3727`

## Step 4: Check Logs Location

In Supabase Dashboard:
1. Go to: **Edge Functions** (left sidebar)
2. Click on: **make-server-e2cf3727**
3. Click on: **Logs** tab (not the general project logs)
4. Make sure you're looking at the right time period
5. Try refreshing the page

## Step 5: Test Direct Function Call

Test the Steam callback endpoint directly (this will fail auth but should show logs):

```bash
curl "https://fjouoltxkrdoxznodqzb.supabase.co/functions/v1/make-server-e2cf3727/steam/callback?test=1" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Replace `YOUR_ANON_KEY` with your anon key.

## Common Issues

### Function Not Deployed
- Check: `supabase functions list`
- Fix: Redeploy the function

### Wrong Project
- Check: Browser Network tab shows which project is being called
- Fix: Make sure `.env.local` points to correct project

### Logs Not Showing
- Check: Are you in the right function's logs tab?
- Check: Is the time filter showing recent logs?
- Try: Refresh the logs page

### Function Crashes Immediately
- Check: Health check endpoint works?
- Check: Any syntax errors in the code?
- Check: Environment variables set correctly?

## Next Steps

1. Test the health check endpoint first
2. If that works, check browser Network tab during sign-in
3. Share the results so we can debug further

