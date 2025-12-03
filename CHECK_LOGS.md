# How to Check Edge Function Logs

The browser console shows a generic error. To see the **actual error** from the backend, check the Edge Function logs:

## Steps:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/fjouoltxkrdoxznodqzb

2. **Navigate to Edge Functions:**
   - Click on **Edge Functions** in the left sidebar
   - Click on **make-server-e2cf3727**

3. **View Logs:**
   - Click on the **Logs** tab
   - You should see logs from your recent sign-in attempt
   - Look for lines that start with `=== BACKEND /steam/callback: ERROR ===`
   - The logs will show:
     - The actual error message
     - Where it failed (user creation, token generation, etc.)
     - Stack traces

4. **What to Look For:**
   - Error messages like:
     - "ANON_KEY not found"
     - "Sign-in failed: ..."
     - "Failed to create Supabase Auth user: ..."
     - "Failed to set password: ..."

## Common Errors You Might See:

- **"ANON_KEY not found"** → The secret isn't accessible
- **"Sign-in failed: Invalid login credentials"** → Password auth issue
- **"Failed to create Supabase Auth user"** → User creation problem
- **"Failed to set password"** → Password setting issue

**Copy the exact error message from the logs and share it!**

