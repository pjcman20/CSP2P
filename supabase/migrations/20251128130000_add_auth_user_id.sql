-- ============================================
-- Migration: Add auth_user_id column to users table
-- Links custom users table to Supabase Auth users
-- ============================================

-- Add auth_user_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Add comment
COMMENT ON COLUMN users.auth_user_id IS 'Reference to Supabase Auth user ID';

-- Update RLS policy to allow users to read their own data via auth.uid()
-- Note: This assumes we'll update RLS policies to use auth.uid() instead of custom session checks

-- For existing users, we'll need to link them manually or via a script
-- This migration just adds the column structure
