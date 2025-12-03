# Steam Authentication with Supabase Auth

## How It Works

Users authenticate via **Steam OAuth only** - no email required. Token generation uses Supabase's admin API directly, eliminating the need for email auth provider.

## Authentication Flow

1. **User clicks "Sign in with Steam"**
2. **Steam authenticates** the user via OpenID
3. **Backend verifies** Steam authentication
4. **Backend creates** Supabase Auth user with dummy email (`steamId@steam.local`)
5. **Backend generates** JWT tokens using GoTrue admin API (direct session creation)
6. **Frontend receives** tokens and establishes Supabase Auth session
7. **User is authenticated** - all future API calls use JWT tokens

## Token Generation Method

The system uses **direct session creation** via GoTrue admin API:
- ✅ No email auth provider required
- ✅ Direct token generation using service role key
- ✅ No password needed
- ✅ Pure Steam authentication

**Fallback**: If direct admin API fails, the system falls back to password-based auth (which requires email auth provider). This ensures compatibility but the primary method works without it.

## Setup Required

**No special setup needed!** The system works with pure Steam authentication.

Optional: If you want to enable the fallback method, you can enable Email Auth Provider in Supabase Dashboard:
1. Go to: Authentication → Providers → Email
2. Enable "Enable Email Provider"
3. **Disable "Confirm email"** - prevents email verification requirements
4. Save

This is only needed if the direct admin API method fails (rare).

## Technical Details

- **User Creation**: Admin API creates user with `steamId@steam.local` email
- **Token Generation**: Direct session creation via `/auth/v1/admin/users/{userId}/sessions`
- **Session Management**: Supabase Auth handles token refresh automatically
- **API Authentication**: All endpoints verify JWT tokens from Supabase Auth

## Summary

**Pure Steam Authentication** → Direct token generation via admin API → No email provider needed → Everything works!

The system uses direct token generation, eliminating the need for email auth provider infrastructure.

