/**
 * Supabase Configuration
 * 
 * IMPORTANT: Uses environment variables to support separate environments:
 * - Localhost development: Uses .env.local
 * - Figma Make production: Uses its own environment variables
 * 
 * This ensures localhost and production don't conflict.
 */

// Get project ID from environment variable (fallback to hardcoded for compatibility)
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 
                         import.meta.env.VITE_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '') ||
                         "fjouoltxkrdoxznodqzb";

// Get anon key from environment variable (fallback to hardcoded for compatibility)
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                             "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqb3VvbHR4a3Jkb3h6bm9kcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODY4NDAsImV4cCI6MjA3OTA2Mjg0MH0.0oHjdbbkdhCiOiCMEcIFhsVRJrt27_2-zhig2334Og8";

// Validate configuration
if (!projectId || !publicAnonKey) {
  console.warn('⚠️ Supabase configuration missing. Check your .env.local file.');
}