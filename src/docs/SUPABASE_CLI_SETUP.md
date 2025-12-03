# Supabase CLI Setup Guide

This guide walks you through setting up and using Supabase CLI for local development.

## Prerequisites

- Supabase CLI installed (✅ Already installed via Homebrew)
- Supabase account and project created
- Project reference: `fjouoltxkrdoxznodqzb`

## Initial Setup

### 1. Login to Supabase CLI

```bash
supabase login
```

This will open a browser window for authentication. After logging in, you'll be able to link your project.

### 2. Link Your Project

```bash
supabase link --project-ref fjouoltxkrdoxznodqzb
```

This connects your local Supabase CLI to your remote project.

### 3. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual Supabase credentials:
- Get `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from: Supabase Dashboard > Settings > API
- Get `SUPABASE_SERVICE_ROLE_KEY` from: Supabase Dashboard > Settings > API (service_role key)
- Get `STEAM_API_KEY` from: https://steamcommunity.com/dev/apikey

## Common Commands

### Database Migrations

```bash
# Push local migrations to remote database
supabase db push

# Pull remote schema changes
supabase db pull

# Create a new migration
supabase migration new migration_name

# Reset local database (applies all migrations)
supabase db reset
```

### Edge Functions

```bash
# Deploy edge function
supabase functions deploy make-server-e2cf3727

# Test function locally
supabase functions serve make-server-e2cf3727

# View function logs
supabase functions logs make-server-e2cf3727
```

### Local Development

```bash
# Start local Supabase stack (database, API, etc.)
supabase start

# Stop local Supabase stack
supabase stop

# View local services status
supabase status
```

### Project Management

```bash
# View linked project info
supabase projects list

# Switch between projects
supabase link --project-ref different-project-ref

# View project settings
supabase projects api-keys --project-ref fjouoltxkrdoxznodqzb
```

## Project Structure

```
supabase/
├── config.toml          # Supabase CLI configuration
├── migrations/          # Database migration files
│   └── [timestamp]_initial_schema.sql
└── functions/           # Edge Functions
    └── make-server-e2cf3727/
        ├── index.tsx
        ├── db.tsx
        ├── steam.tsx
        └── ...
```

## Workflow

### Making Database Changes

1. Make changes to your database schema
2. Create a migration:
   ```bash
   supabase migration new add_new_feature
   ```
3. Edit the migration file in `supabase/migrations/`
4. Apply migration:
   ```bash
   supabase db push
   ```

### Deploying Edge Functions

1. Make changes to function code in `supabase/functions/make-server-e2cf3727/`
2. Test locally:
   ```bash
   supabase functions serve make-server-e2cf3727
   ```
3. Deploy:
   ```bash
   supabase functions deploy make-server-e2cf3727
   ```

## Troubleshooting

### "Access token not provided"

Run `supabase login` to authenticate.

### "Repository not found"

Make sure you've linked the correct project:
```bash
supabase link --project-ref fjouoltxkrdoxznodqzb
```

### Migration conflicts

If migrations are out of sync:
```bash
# Pull latest schema
supabase db pull

# Create a new migration to sync differences
supabase migration new sync_changes
```

## Next Steps

- See [SUPABASE_ENVIRONMENTS.md](./SUPABASE_ENVIRONMENTS.md) for environment strategy
- Check [CURSOR_SETUP.md](../CURSOR_SETUP.md) for full project setup
- Review [EXPORT_GUIDE.md](../EXPORT_GUIDE.md) for deployment guide

## Resources

- [Supabase CLI Docs](https://supabase.com/docs/reference/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

