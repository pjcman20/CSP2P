// Supabase Auth integration utilities for Steam authentication
// Production-ready implementation with proper error handling and security

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Try multiple possible env var names for anon key
// Supabase CLI blocks SUPABASE_* prefixed secrets, so we use ANON_KEY
// But Supabase might also auto-provide SUPABASE_ANON_KEY
const supabaseAnonKey = Deno.env.get('ANON_KEY') || 
                        Deno.env.get('SUPABASE_ANON_KEY') ||
                        null;

// Validate environment variables at module load
// Use try-catch to prevent module load failures from crashing the function
try {
  if (!supabaseUrl) {
    console.error('❌ FATAL: SUPABASE_URL environment variable not set');
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  if (!supabaseServiceKey) {
    console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!supabaseAnonKey) {
    console.warn('⚠️ ANON_KEY or SUPABASE_ANON_KEY not set - token generation will fail');
    console.warn('⚠️ Set ANON_KEY secret: supabase secrets set ANON_KEY=your-anon-key --project-ref fjouoltxkrdoxznodqzb');
  }

  console.log('✅ Auth module initialized successfully');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service key available:', !!supabaseServiceKey);
  console.log('Anon key available:', !!supabaseAnonKey);
} catch (error) {
  console.error('❌ FATAL ERROR in auth module initialization:', error);
  // Don't throw - let the function start and handle errors at runtime
  // This prevents the entire function from failing to load
}

// Create admin client for user management
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface SteamUserProfile {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface SupabaseAuthResult {
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, any>;
    app_metadata: Record<string, any>;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserResult {
  user: any;
  steamId: string;
}

/**
 * Validate Steam ID format
 */
function validateSteamId(steamId: string): boolean {
  // Steam ID64 is 17 digits
  return /^\d{17}$/.test(steamId);
}

/**
 * Generate a secure random password for temporary authentication
 * Must be <= 72 characters (Supabase limit)
 * Uses crypto.randomUUID() for cryptographically secure randomness
 */
function generateSecurePassword(): string {
  // Generate a secure password exactly 72 characters
  // Use 2 UUIDs (32 chars each = 64) + random hex (8 chars) = 72 total
  const uuid1 = crypto.randomUUID().replace(/-/g, ''); // 32 chars
  const uuid2 = crypto.randomUUID().replace(/-/g, ''); // 32 chars
  
  // Add some random bytes for extra entropy (8 characters)
  const randomBytes = new Uint8Array(4); // 4 bytes = 8 hex chars
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(''); // 8 chars
  
  // Combine: 32 + 32 + 8 = 72 characters (exactly at limit)
  const password = `${uuid1}${uuid2}${randomHex}`;
  
  // Safety check - ensure it's exactly 72 characters
  if (password.length > 72) {
    console.warn(`Password too long (${password.length} chars), truncating to 72`);
    return password.substring(0, 72);
  }
  
  console.log(`Generated password length: ${password.length} characters`);
  return password;
}

/**
 * Find existing Supabase Auth user by Steam ID
 * Uses listUsers and filters by metadata (Supabase doesn't have getUserByEmail in admin API)
 */
async function findUserBySteamId(steamId: string): Promise<any | null> {
  try {
    console.log('🔍 Searching for user with Steam ID:', steamId);
    
    // Supabase admin API doesn't have getUserByEmail
    // We need to list users and filter by metadata
    // Use pagination to handle large user bases
    let page = 1;
    const perPage = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
        page: page,
        perPage: perPage,
      });
      
      if (listError) {
        console.error('Error listing users:', listError);
        return null;
      }
      
      // Search for user with matching Steam ID
      const foundUser = usersData.users.find(
        (u: any) => {
          const userSteamId = u.user_metadata?.steam_id || u.app_metadata?.steam_id;
          return userSteamId === steamId;
        }
      );
      
      if (foundUser) {
        console.log('✅ Found existing user:', foundUser.id);
        return foundUser;
      }
      
      // Check if there are more pages
      hasMore = usersData.users.length === perPage;
      page++;
      
      // Safety limit - don't search forever
      if (page > 10) {
        console.warn('⚠️ Reached search limit, user not found');
        break;
      }
    }
    
    console.log('❌ User not found with Steam ID:', steamId);
    return null;
  } catch (error) {
    console.error('Error finding user by Steam ID:', error);
    return null;
  }
}

/**
 * Create or get Supabase Auth user for Steam authentication
 * Handles race conditions and duplicate user creation attempts
 */
export async function createOrGetSupabaseUser(
  steamProfile: SteamUserProfile
): Promise<SupabaseAuthResult> {
  // Validate input
  if (!validateSteamId(steamProfile.steamId)) {
    throw new Error(`Invalid Steam ID format: ${steamProfile.steamId}`);
  }

  if (!steamProfile.personaName || steamProfile.personaName.trim().length === 0) {
    throw new Error('Persona name is required');
  }

  try {
    console.log('🔐 Creating/getting Supabase Auth user for Steam ID:', steamProfile.steamId);
    
    // Check if user already exists
    const existingUser = await findUserBySteamId(steamProfile.steamId);

    if (existingUser) {
      console.log('✅ Found existing Supabase Auth user:', existingUser.id);
      
      // Update user metadata with latest Steam profile info
      try {
        const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              steam_id: steamProfile.steamId,
              provider: 'steam',
              persona_name: steamProfile.personaName,
              avatar_url: steamProfile.avatarUrl,
              profile_url: steamProfile.profileUrl,
              updated_at: new Date().toISOString(),
            },
            app_metadata: {
              provider: 'steam',
              steam_id: steamProfile.steamId,
            },
          }
        );

        if (updateError) {
          console.error('Error updating user metadata:', updateError);
          // Continue with existing user data if update fails
        } else if (updatedUser?.user) {
          // Generate session with updated user
          return await generateSupabaseSession(updatedUser.user);
        }
      } catch (updateError) {
        console.error('Error updating user metadata:', updateError);
        // Continue with existing user
      }

      // Generate session for existing user
      return await generateSupabaseSession(existingUser);
    }

    // Create new Supabase Auth user
    // Steam doesn't provide email, so we use a deterministic dummy email format
    const dummyEmail = `${steamProfile.steamId}@steam.local`;
    
    console.log('🆕 Creating new Supabase Auth user with email:', dummyEmail);
    
    try {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: dummyEmail,
        email_confirm: true, // Auto-confirm since Steam already verified
        user_metadata: {
          steam_id: steamProfile.steamId,
          provider: 'steam',
          persona_name: steamProfile.personaName,
          avatar_url: steamProfile.avatarUrl || '',
          profile_url: steamProfile.profileUrl || '',
          created_at: new Date().toISOString(),
        },
        app_metadata: {
          provider: 'steam',
          steam_id: steamProfile.steamId,
        },
      });

      if (createError) {
        // Handle race condition: user might have been created between check and create
        const isDuplicateError = createError.message?.includes('already registered') || 
                                 createError.message?.includes('already exists') ||
                                 createError.message?.includes('duplicate') ||
                                 createError.message?.toLowerCase().includes('email');
        
        if (isDuplicateError) {
          console.log('⚠️ User already exists (race condition or duplicate), fetching existing user...');
          console.log('Error details:', createError.message);
          
          // Try to find the existing user
          const existingUser = await findUserBySteamId(steamProfile.steamId);
          if (existingUser) {
            console.log('✅ Found existing user after duplicate error, generating session...');
            return await generateSupabaseSession(existingUser);
          }
          
          // If we can't find by Steam ID, try to find by email pattern
          console.log('⚠️ Could not find user by Steam ID, user may exist with different metadata');
          // Don't throw - let the outer catch handle it with better error message
        }
        
        // Re-throw with more context
        throw new Error(`Failed to create Supabase Auth user: ${createError.message}`);
      }

      if (!newUser?.user) {
        throw new Error('User creation succeeded but no user data returned');
      }

      console.log('✅ Created new Supabase Auth user:', newUser.user.id);

      // Generate session for new user
      return await generateSupabaseSession(newUser.user);
    } catch (createError: any) {
      // If creation fails due to duplicate, try to find existing user
      if (createError.message?.includes('already') || createError.message?.includes('duplicate')) {
        const duplicateUser = await findUserBySteamId(steamProfile.steamId);
        if (duplicateUser) {
          console.log('Found duplicate user, generating session...');
          return await generateSupabaseSession(duplicateUser);
        }
      }
      throw createError;
    }
  } catch (error) {
    console.error('❌ Error in createOrGetSupabaseUser:', error);
    throw error instanceof Error ? error : new Error('Unknown error creating user');
  }
}

/**
 * Generate a Supabase Auth session for a user
 * Uses direct token generation via GoTrue admin API (no email auth provider required)
 */
async function generateSupabaseSession(user: any): Promise<SupabaseAuthResult> {
  try {
    const userId = typeof user === 'string' ? user : user.id;
    console.log('🎫 Generating Supabase Auth session for user:', userId);
    
    // Get user details if we only have ID
    let userData = typeof user === 'object' ? user : null;
    if (!userData) {
      const { data: fetchedUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
      
      if (getUserError || !fetchedUser?.user) {
        throw new Error(`Failed to get user: ${getUserError?.message || 'User not found'}`);
      }
      userData = fetchedUser.user;
    }

    // Try direct token generation first (no email auth provider required)
    try {
      return await generateSupabaseSessionWithAdminAPI(userData);
    } catch (adminError) {
      console.warn('⚠️ Direct token generation failed, falling back to password method:', adminError);
      // Fallback to password-based auth if direct generation fails
      return await generateSupabaseSessionWithPassword(userData);
    }
  } catch (error) {
    console.error('❌ Error generating Supabase Auth session:', error);
    throw error instanceof Error ? error : new Error('Unknown error generating session');
  }
}

/**
 * Generate session using direct GoTrue admin API
 * Creates session directly without requiring email auth provider
 */
async function generateSupabaseSessionWithAdminAPI(userData: any): Promise<SupabaseAuthResult> {
  const userId = userData.id;
  console.log('🔑 Generating session using direct admin API...');
  console.log('User ID:', userId);

  // Use GoTrue admin API to create session directly
  // This endpoint creates a session without requiring password or email verification
  const sessionUrl = `${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`;
  
  console.log('Creating session via admin API:', sessionUrl);
  
  const sessionResponse = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  console.log('Admin API session response status:', sessionResponse.status);

  if (!sessionResponse.ok) {
    const errorText = await sessionResponse.text();
    let errorMessage = 'Failed to create session via admin API';
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
      console.error('Admin API error details:', JSON.stringify(errorJson, null, 2));
    } catch {
      console.error('Admin API error text:', errorText.substring(0, 500));
    }
    throw new Error(`Admin API session creation failed: ${errorMessage}`);
  }

  const sessionData = await sessionResponse.json();
  
  // Validate response
  if (!sessionData.access_token || !sessionData.refresh_token) {
    console.error('Invalid session response:', sessionData);
    throw new Error('Invalid session response from admin API: missing tokens');
  }

  console.log('✅ Generated Supabase Auth session via admin API successfully');

  return {
    user: {
      id: userData.id,
      email: userData.email || `${userData.id}@steam.local`,
      user_metadata: userData.user_metadata || {},
      app_metadata: userData.app_metadata || {},
    },
    session: {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_in: sessionData.expires_in || 3600,
      token_type: sessionData.token_type || 'bearer',
    },
    accessToken: sessionData.access_token,
    refreshToken: sessionData.refresh_token,
  };
}

/**
 * Generate session using password-based authentication (fallback method)
 * Sets a temporary password and signs in to get tokens
 * 
 * NOTE: This fallback method requires Email Auth Provider to be enabled
 * Only used if direct admin API method fails
 */
async function generateSupabaseSessionWithPassword(userData: any): Promise<SupabaseAuthResult> {
  const userId = userData.id;
  const email = userData.email || `${userId}@steam.local`;

  console.log('🔑 Generating session using password-based authentication...');
  console.log('User ID:', userId);
  console.log('User email (identifier only):', email);
  console.log('Anon key available:', !!supabaseAnonKey);

  if (!supabaseAnonKey) {
    console.error('❌ ANON_KEY not found in environment variables');
    const allEnvVars = Object.keys(Deno.env.toObject());
    const relevantVars = allEnvVars.filter(k => k.includes('ANON') || k.includes('KEY') || k.includes('SUPABASE'));
    console.error('Available env vars:', relevantVars);
    throw new Error('ANON_KEY environment variable not set. Set it with: supabase secrets set ANON_KEY=your-anon-key --project-ref fjouoltxkrdoxznodqzb. Also ensure Email Auth Provider is enabled in Supabase Dashboard (infrastructure only - users authenticate via Steam).');
  }

  // Generate a secure temporary password
  const tempPassword = generateSecurePassword();
  
  console.log('Setting temporary password for user...');
  
  // Ensure user is confirmed (required for password auth)
  // Set temporary password for the user
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
    email_confirm: true, // Ensure email is confirmed
  });

  if (updateError) {
    console.error('Error setting temp password:', updateError);
    console.error('Update error details:', JSON.stringify(updateError, null, 2));
    throw new Error(`Failed to set password: ${updateError.message}`);
  }

  console.log('✅ Password set successfully');
  console.log('Signing in with temporary password to get tokens...');

  const signInUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  console.log('Sign-in URL:', signInUrl);
  
  const signInResponse = await fetch(signInUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      email: email,
      password: tempPassword,
    }),
  });

  console.log('Sign-in response status:', signInResponse.status);
  console.log('Sign-in response ok:', signInResponse.ok);

  if (!signInResponse.ok) {
    const errorText = await signInResponse.text();
    let errorMessage = 'Failed to sign in';
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
      console.error('Sign-in error details:', JSON.stringify(errorJson, null, 2));
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('Sign-in error text (not JSON):', errorText.substring(0, 500));
    }
    console.error('Error signing in:', errorMessage);
    console.error('Response status:', signInResponse.status);
    
    // Provide helpful error message
    if (errorMessage.includes('Invalid login credentials') || 
        errorMessage.includes('Email not confirmed') ||
        errorMessage.includes('email provider') ||
        errorMessage.toLowerCase().includes('email')) {
      throw new Error(`Token generation failed: ${errorMessage}. This fallback method requires Email Auth Provider to be enabled. The primary method (admin API) should work without it.`);
    }
    
    throw new Error(`Sign-in failed: ${errorMessage}`);
  }

  const tokens = await signInResponse.json();
  
  // Validate token response
  if (!tokens.access_token || !tokens.refresh_token) {
    console.error('Invalid token response:', tokens);
    throw new Error('Invalid token response from Supabase Auth: missing tokens');
  }

  console.log('✅ Generated Supabase Auth session successfully');

  return {
    user: {
      id: userData.id,
      email: userData.email || email,
      user_metadata: userData.user_metadata || {},
      app_metadata: userData.app_metadata || {},
    },
    session: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in || 3600,
      token_type: tokens.token_type || 'bearer',
    },
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

/**
 * Verify Supabase Auth token and get user
 * Returns null if token is invalid or expired
 */
export async function verifySupabaseToken(token: string): Promise<any | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }

  try {
    const { data: { user }, error } = await adminClient.auth.getUser(token);
    
    if (error) {
      // Don't log expected errors (expired tokens, etc.)
      if (!error.message?.includes('expired') && !error.message?.includes('invalid')) {
        console.error('Token verification error:', error.message);
      }
      return null;
    }
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Get Steam ID from Supabase Auth user metadata
 * Checks both user_metadata and app_metadata for Steam ID
 */
export function getSteamIdFromAuthUser(authUser: any): string | null {
  if (!authUser) {
    return null;
  }

  const steamId = authUser.user_metadata?.steam_id || authUser.app_metadata?.steam_id;
  
  // Validate Steam ID format
  if (steamId && validateSteamId(steamId)) {
    return steamId;
  }
  
  return null;
}

/**
 * Extract and verify Supabase Auth token from request headers
 * Returns the authenticated user and Steam ID, or null if invalid
 * This is the main function used by API endpoints for authentication
 */
export async function getAuthUserFromRequest(
  authHeader: string | null
): Promise<AuthUserResult | null> {
  // Validate header format
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extract token
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (!token || token.length === 0) {
    return null;
  }

  // Verify token and get user
  const authUser = await verifySupabaseToken(token);
  
  if (!authUser) {
    return null;
  }

  // Extract Steam ID from user metadata
  const steamId = getSteamIdFromAuthUser(authUser);
  
  if (!steamId) {
    console.error('Auth user found but no valid Steam ID in metadata. User ID:', authUser.id);
    return null;
  }

  return { 
    user: authUser, 
    steamId 
  };
}
