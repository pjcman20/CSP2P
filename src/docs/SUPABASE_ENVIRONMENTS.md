# Supabase Environment Strategy Guide

This document explains the different approaches to managing multiple Supabase environments (development, staging, production) and their tradeoffs.

## Overview

When scaling your application, you'll need to decide how to manage different environments. Supabase offers two main approaches:

1. **Supabase Branching** (within a single project)
2. **Separate Projects** (completely isolated)

---

## Option A: Supabase Branching (Within Project)

### How It Works

Supabase branching allows you to create multiple database branches within a single Supabase project. Each branch has its own database schema and can be used for different environments.

### Pros ✅

- **Single Billing**: One project, one bill - easier cost management
- **Shared Resources**: API keys, project settings, and configuration are shared
- **Easier Data Sync**: Can easily copy data between branches
- **Simpler Management**: One project dashboard to manage
- **Cost Effective**: No additional project costs
- **Faster Setup**: Quick branch creation from existing schema

### Cons ❌

- **Less Isolation**: Shared project-level resources (API keys, settings)
- **Potential Conflicts**: Team members working on different branches simultaneously
- **Shared Rate Limits**: API rate limits apply across all branches
- **Limited Branching**: Not all Supabase features support branching equally
- **Less Flexibility**: Can't have completely different configurations per environment

### Best For

- Small teams (2-5 developers)
- Rapid iteration and development
- Cost-conscious projects
- Projects where environments need similar configurations
- Early-stage applications

### Setup Steps

```bash
# Create a new branch
supabase branches create staging

# Switch to a branch
supabase branches switch staging

# List all branches
supabase branches list

# Merge changes between branches
supabase branches merge staging main
```

---

## Option B: Separate Projects

### How It Works

Create completely separate Supabase projects for each environment (dev, staging, production). Each project has its own database, API keys, and configuration.

### Pros ✅

- **Complete Isolation**: Each environment is completely independent
- **Independent Scaling**: Scale each environment separately
- **Separate Billing**: Track costs per environment
- **No Conflicts**: Team members can work without interfering
- **Different Configurations**: Each project can have different settings
- **Production Safety**: Production issues don't affect development
- **Independent Rate Limits**: Each project has its own API limits

### Cons ❌

- **More Complex Setup**: Need to manage multiple projects
- **Separate Credentials**: Different API keys for each environment
- **Harder Data Migration**: Copying data between projects requires more work
- **Higher Cost**: Multiple projects = multiple bills
- **More Management**: Multiple dashboards to monitor
- **Environment Variable Complexity**: Need to manage different keys per environment

### Best For

- Larger teams (5+ developers)
- Production-critical applications
- Strict environment requirements
- Projects with different scaling needs per environment
- Enterprise applications

### Setup Steps

1. Create separate projects in Supabase Dashboard:
   - `csp2p-dev`
   - `csp2p-staging`
   - `csp2p-production`

2. Link each project locally:
```bash
# Development
supabase link --project-ref dev-project-ref

# Staging
supabase link --project-ref staging-project-ref

# Production
supabase link --project-ref prod-project-ref
```

3. Use environment-specific configs:
```bash
# .env.development
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev-anon-key

# .env.staging
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key

# .env.production
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key
```

---

## Recommendation for CSP2P

### Current Strategy: Single Project (Development)

For now, we're using a **single Supabase project** for development. This is the simplest approach and perfect for:
- Solo or small team development
- Rapid iteration
- Learning and experimentation

**Project Reference**: `fjouoltxkrdoxznodqzb`

### Future Strategy: Separate Projects (When Scaling)

When you're ready to add staging/production environments, we recommend **separate projects** because:

1. **Production Safety**: Complete isolation protects production data
2. **Team Growth**: As your team grows, separate projects prevent conflicts
3. **Different Configurations**: Production may need different settings (backups, scaling, etc.)
4. **Cost Tracking**: Easier to track production vs development costs

### Migration Path

When ready to add environments:

1. **Keep current project as Development**
   - Continue using `fjouoltxkrdoxznodqzb` for dev

2. **Create Staging Project**
   - Create new project: `csp2p-staging`
   - Copy schema: `supabase db dump > staging-schema.sql`
   - Apply to staging: `supabase db push --project-ref staging-ref`

3. **Create Production Project**
   - Create new project: `csp2p-production`
   - Copy schema from staging (after testing)
   - Set up production-specific configurations

4. **Update CI/CD**
   - Configure deployment pipelines for each environment
   - Use environment-specific secrets

---

## Environment Variables Management

### Development (Current)

```env
# .env.local (gitignored)
VITE_SUPABASE_URL=https://fjouoltxkrdoxznodqzb.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
```

### Future: Multi-Environment Setup

```env
# .env.development
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev-anon-key

# .env.staging
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging-anon-key

# .env.production
VITE_SUPABASE_URL=https://prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key
```

---

## Edge Functions Deployment

### Current Setup

Edge functions are located in `supabase/functions/make-server-e2cf3727/`

### Deploy to Development

```bash
# Login first (one-time)
supabase login

# Link to project
supabase link --project-ref fjouoltxkrdoxznodqzb

# Deploy function
supabase functions deploy make-server-e2cf3727
```

### Future: Multi-Environment Deployment

```bash
# Deploy to staging
supabase functions deploy make-server-e2cf3727 --project-ref staging-ref

# Deploy to production
supabase functions deploy make-server-e2cf3727 --project-ref prod-ref
```

---

## Database Migrations

### Current Setup

Migrations are in `supabase/migrations/` directory.

### Apply Migrations

```bash
# Push migrations to linked project
supabase db push

# Or apply specific migration
supabase migration up
```

### Future: Environment-Specific Migrations

```bash
# Development
supabase db push --project-ref dev-ref

# Staging (after testing)
supabase db push --project-ref staging-ref

# Production (after staging validation)
supabase db push --project-ref prod-ref
```

---

## Decision Matrix

| Factor | Branching | Separate Projects |
|-------|-----------|-------------------|
| **Cost** | ✅ Lower | ❌ Higher |
| **Isolation** | ❌ Less | ✅ Complete |
| **Setup Complexity** | ✅ Simpler | ❌ More Complex |
| **Team Size** | ✅ Small (2-5) | ✅ Large (5+) |
| **Production Safety** | ⚠️ Moderate | ✅ High |
| **Data Sync** | ✅ Easy | ❌ Harder |
| **Configuration Flexibility** | ❌ Limited | ✅ Full |

---

## Next Steps

1. ✅ **Current**: Single project for development
2. **Phase 1**: Add staging project when ready for testing
3. **Phase 2**: Add production project when launching
4. **Phase 3**: Set up CI/CD for automated deployments

---

## Resources

- [Supabase Branching Docs](https://supabase.com/docs/guides/cli/local-development#branching)
- [Supabase Multi-Environment Guide](https://supabase.com/docs/guides/cli/managing-environments)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)

