// Supabase Auth client for frontend
// Production-ready implementation with proper error handling and session management

import { createClient, type Session, type User } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

// Validate configuration
if (!projectId || !publicAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

// Create Supabase client with auth
export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  auth: {
    autoRefreshToken: true, // Keep enabled for security, but only refreshes when needed
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce', // Use PKCE flow for better security
    // Reduce refresh frequency to prevent excessive REST requests
    // Tokens refresh automatically when expired (not on every request)
  },
});

/**
 * Get current session with error handling
 * Returns null if no session or error occurred
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Unexpected error getting session:', error);
    return null;
  }
}

/**
 * Get current user with error handling
 * Returns null if no user or error occurred
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Unexpected error getting user:', error);
    return null;
  }
}

/**
 * Get access token for API calls
 * Returns null if no valid session
 * Automatically refreshes token if expired
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await getCurrentSession();
    
    if (!session) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      const buffer = 5 * 60; // 5 minutes
      
      if (expiresAt - now < buffer) {
        // Token expiring soon, try to refresh
        console.log('Token expiring soon, refreshing...');
        const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('Error refreshing session:', error);
          return null;
        }
        
        return newSession?.access_token || null;
      }
    }

    return session.access_token || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Sign out current user
 * Clears session and local storage
 */
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  } catch (error) {
    console.error('Unexpected error signing out:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 * Returns true if valid session exists
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

/**
 * Listen to auth state changes
 * Useful for updating UI when user logs in/out
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
