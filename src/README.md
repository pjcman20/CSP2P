# CS Trading Hub 🎮

A visual discovery and matching platform for Counter-Strike skin traders. Create "faux" trade offers showcasing what you're offering and seeking, then execute actual trades through Steam when you find a match.

![CS Trading Hub](https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop)

## 🎯 What This Does

**CS Trading Hub is NOT a trading platform** - it's a **discovery layer** that helps traders find matches before initiating Steam trades.

### How It Works:
1. **Sign in with Steam OAuth**
2. **Create a trade offer** showing what you have and what you want
3. **Browse the marketplace** to find matching offers
4. **Contact traders** and execute trades through Steam

---

## ✨ Features

- 🔐 **Steam OAuth Integration** - Secure authentication via Steam
- 📦 **Inventory Integration** - Fetch and display Steam CS2 inventories
- 🎨 **Visual Marketplace** - Browse trade offers with rich item cards
- 🔍 **Smart Placeholders** - "Any Knife", "Any Offers", "Any Cases" for flexible trading
- 💬 **Trade Request System** - Send and receive trade requests
- ⭐ **Reputation System** - Community-driven trader ratings
- 🌐 **Real-time Updates** - See new offers as they're created
- 🎯 **User Dashboard** - Manage your offers and trade requests

---

## 🏗️ Tech Stack

### Frontend
- **React 18** + TypeScript
- **Tailwind CSS v4** (no config needed!)
- **Vite** for blazing fast dev experience
- **Lucide React** for icons
- **Sonner** for toast notifications

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **Hono** web framework
- **PostgreSQL** with Row Level Security
- **Supabase Auth** for Steam OAuth
- **Supabase Storage** for user assets

### APIs
- **Steam Web API** for inventory fetching
- **Steam OpenID** for authentication

---

## 🚀 Getting Started

See **[EXPORT_GUIDE.md](./EXPORT_GUIDE.md)** for detailed setup instructions.

### Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see EXPORT_GUIDE.md)
cp .env.example .env.local

# Run development server
npm run dev

# Deploy edge functions
supabase functions deploy make-server-e2cf3727
```

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `/App.tsx` | Main React component with routing |
| `/components/MarketplaceFeed.tsx` | Homepage feed |
| `/components/CreateOfferModal.tsx` | Offer creation flow |
| `/components/OfferCard.tsx` | Trade offer display |
| `/supabase/functions/server/index.tsx` | Backend API server |
| `/supabase/functions/server/db.tsx` | Database queries |
| `/utils/steamAuth.ts` | Steam OAuth logic |
| `/SECURITY_ROADMAP.md` | Security implementation status |

---

## 🎨 Design System

CS2-inspired gaming aesthetic:

```css
/* Primary Colors */
--cs-orange: #FF6A00;        /* Primary CTAs */
--electric-blue: #00D9FF;     /* Accents & highlights */
--bg-deep: #0f1419;           /* Background */
--bg-base: #1B2838;           /* Cards */

/* Rarity Colors (from CS2) */
--rarity-consumer: #b0c3d9;
--rarity-industrial: #5e98d9;
--rarity-milspec: #4b69ff;
--rarity-restricted: #8847ff;
--rarity-classified: #d32ce6;
--rarity-covert: #eb4b4b;
--rarity-gold: #e4ae39;
```

**Typography**: System font stack for performance
**Motion**: Subtle hover effects with `transition-all duration-300`
**Glow effects**: `.glow-orange` and `.glow-blue` classes

---

## 🗄️ Database Schema

### Core Tables

**users** - Steam user profiles
```sql
- steam_id (PK)
- persona_name
- avatar_url
- profile_url
- trade_url
```

**offers** - Trade offers
```sql
- id (PK)
- user_steam_id (FK)
- offering (JSONB) - Array of items
- seeking (JSONB) - Array of items
- notes
- status (active/completed/cancelled)
```

**trade_requests** - Trade initiation requests
```sql
- id (PK)
- offer_id (FK)
- requester_steam_id (FK)
- message
- status (pending/accepted/declined)
```

**inventory_cache** - Cached Steam inventories
```sql
- steam_id (PK)
- inventory_data (JSONB)
- cached_at
```

See `/supabase/migrations/` for full schema.

---

## 🔐 Security

Comprehensive security implementation with RLS policies. See **[SECURITY_ROADMAP.md](./SECURITY_ROADMAP.md)** for:

✅ **Completed:**
- Input validation on all endpoints
- SQL injection prevention
- RLS policies on all tables

🚧 **In Progress:**
- Rate limiting
- CSRF protection
- Content security policies

---

## 🐛 Known Issues

See [EXPORT_GUIDE.md](./EXPORT_GUIDE.md#-known-issues-to-fix) for current bugs and issues.

---

## 📝 Development Guidelines

### Code Style
- Use TypeScript for type safety
- Prefer functional components with hooks
- Keep components small and focused
- Use Tailwind utilities, avoid custom CSS

### Git Workflow
- Feature branches from `main`
- Descriptive commit messages
- Test locally before pushing

### Database Changes
- Always create migrations in `/supabase/migrations/`
- Test RLS policies thoroughly
- Never expose service role key to frontend

---

## 🚢 Deployment

### Frontend
Deploy to Vercel/Netlify:
```bash
npm run build
# Deploy dist/ directory
```

### Backend
Deploy Edge Functions:
```bash
supabase functions deploy make-server-e2cf3727
```

### Database
Push migrations:
```bash
supabase db push
```

---

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

MIT License - Feel free to use this project as a starting point for your own trading platform.

---

## 🎮 About Counter-Strike Trading

This platform focuses on CS2 (Counter-Strike 2) skin trading. Skins are cosmetic items with varying rarity levels (Consumer → Gold) and wear values (Factory New → Battle-Scarred).

**Important:** All actual trades happen through Steam's official trading system. This platform only helps traders discover each other.

---

## 📞 Support

- **Issues**: Use GitHub Issues for bugs
- **Questions**: Check `/EXPORT_GUIDE.md` first
- **Steam API**: [steamcommunity.com/dev](https://steamcommunity.com/dev)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)

---

Built with ❤️ for the CS2 trading community
