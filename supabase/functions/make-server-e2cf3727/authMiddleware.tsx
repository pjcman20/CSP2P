// Authentication middleware for Hono routes
// Provides consistent authentication handling across all endpoints

import { Context } from "npm:hono";
import * as auth from "./auth.tsx";

export interface AuthenticatedContext {
  steamId: string;
  authUser: any;
  userId: string; // Supabase Auth user ID
}

/**
 * Authentication middleware for Hono routes
 * Verifies Supabase Auth token and adds user info to context
 * 
 * Usage:
 * app.get('/protected', authMiddleware, async (c) => {
 *   const { steamId, authUser } = c.get('auth');
 *   // Use steamId and authUser
 * });
 */
export async function authMiddleware(c: Context, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    const authResult = await auth.getAuthUserFromRequest(authHeader);
    
    if (!authResult) {
      return c.json({ 
        error: 'Authentication required',
        message: 'Invalid or expired session. Please log in again.' 
      }, 401);
    }

    // Store auth info in context for route handlers
    c.set('auth', {
      steamId: authResult.steamId,
      authUser: authResult.user,
      userId: authResult.user.id,
    } as AuthenticatedContext);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication' 
    }, 500);
  }
}

/**
 * Optional authentication middleware
 * Adds auth info if available, but doesn't require it
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuthMiddleware(c: Context, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader) {
      const authResult = await auth.getAuthUserFromRequest(authHeader);
      
      if (authResult) {
        c.set('auth', {
          steamId: authResult.steamId,
          authUser: authResult.user,
          userId: authResult.user.id,
        } as AuthenticatedContext);
      }
    }

    await next();
  } catch (error) {
    // Don't fail on optional auth errors, just continue
    console.warn('Optional auth middleware error:', error);
    await next();
  }
}

/**
 * Helper to get auth info from context
 * Throws error if not authenticated (should only be called after authMiddleware)
 */
export function getAuthFromContext(c: Context): AuthenticatedContext {
  const authInfo = c.get('auth') as AuthenticatedContext | undefined;
  
  if (!authInfo) {
    throw new Error('Authentication required but not found in context');
  }
  
  return authInfo;
}

