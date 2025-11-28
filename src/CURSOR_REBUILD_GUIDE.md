# 🎮 CS Trading Hub - Complete Rebuild Guide for Cursor AI

**Purpose**: This document contains ALL context needed to recreate the CS Trading Hub application from scratch in Cursor IDE.

**Instructions for Cursor AI**: Read this entire document, then help the user rebuild each component following the specifications exactly.

---

## 📋 Project Overview

### What It Is
CS Trading Hub is a visual discovery and matching platform for Counter-Strike 2 skin traders. It's NOT a trading platform—it's a discovery layer that helps traders find matches before initiating Steam trades.

### Core Concept
Users create "faux" trade offers showing:
- **What they're offering** (their CS2 skins)
- **What they want** (skins they're seeking)
- **Notes** (additional details)

Then browse a marketplace feed to find matching traders and execute actual trades through Steam.

### Key Features
1. **Steam OAuth Login** - Authenticate via Steam OpenID
2. **Inventory Integration** - Fetch user's CS2 inventory from Steam API
3. **Marketplace Feed** - Browse all active trade offers
4. **Create/Edit Offers** - Visual offer creation with inventory selector
5. **Placeholder Items** - Special items like "Any Knife", "Any Offers", "Any Cases"
6. **Trade Requests** - Send requests to other traders
7. **User Dashboard** - Manage your offers and requests
8. **Reputation System** - Community ratings (backend ready)

---

## 🎨 Design System

### Color Palette (CS2-Inspired Gaming Aesthetic)
```css
/* Primary Colors */
--cs-orange: #FF6A00;              /* Primary CTAs, highlights */
--cs-orange-bright: #FF8533;       /* Hover states */
--electric-blue: #00D9FF;          /* Accents, links */
--electric-blue-dim: #00B8D4;      /* Hover states */

/* Backgrounds */
--bg-deep: #0f1419;                /* Page background */
--bg-base: #1B2838;                /* Card backgrounds */
--bg-elevated: #2a475e;            /* Elevated elements */
--bg-overlay: rgba(27, 40, 56, 0.95); /* Modal overlays */

/* Text */
--text-primary: #ffffff;
--text-secondary: #b8b6b4;
--text-tertiary: #8b8a88;

/* CS2 Item Rarity Colors */
--rarity-consumer: #b0c3d9;
--rarity-industrial: #5e98d9;
--rarity-milspec: #4b69ff;
--rarity-restricted: #8847ff;
--rarity-classified: #d32ce6;
--rarity-covert: #eb4b4b;
--rarity-gold: #e4ae39;
```

### Typography
- **Base**: System font stack for performance
- **Headings**: Same font, various weights
- **Monospace**: For float values (CS2 skin wear)

### Design Principles
- **Dark gaming aesthetic** with blue/orange accents
- **Subtle glow effects** on hover (`.glow-orange`, `.glow-blue`)
- **Smooth transitions** (300ms duration)
- **Responsive design** (mobile-first approach)
- **Atmospheric backgrounds** with noise texture

---

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** (dev server & build tool)
- **Tailwind CSS v4** (utility-first styling)
- **Lucide React** (icons)
- **Sonner** (toast notifications)
- **Motion/React** (animations - optional)

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **Hono** web framework
- **PostgreSQL** with Row Level Security
- **Supabase Auth** (Steam OAuth)

### External APIs
- **Steam Web API** (inventory fetching)
- **Steam OpenID** (authentication)

---

## 📂 Complete File Structure

```
cs-trading-hub/
├── public/
│   └── assets/                    # Images for placeholder items
│       ├── any-knife.png
│       ├── any-offers.png
│       └── any-cases.png
├── src/
│   ├── App.tsx                    # Main app with routing
│   ├── main.tsx                   # React entry point
│   ├── components/
│   │   ├── MarketplaceFeed.tsx    # Homepage feed
│   │   ├── CreateOfferModal.tsx   # Offer creation flow
│   │   ├── OfferCard.tsx          # Trade offer display
│   │   ├── OfferDetailView.tsx    # Detailed offer view
│   │   ├── Dashboard.tsx          # User dashboard
│   │   ├── InventorySelector.tsx  # Steam inventory picker
│   │   ├── TradeUrlModal.tsx      # Set trade URL
│   │   ├── types.ts               # TypeScript types
│   │   └── ui/                    # Reusable UI components
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── textarea.tsx
│   │       └── card.tsx
│   ├── utils/
│   │   ├── steamAuth.ts           # Steam OAuth logic
│   │   ├── offerApi.ts            # API calls to backend
│   │   ├── pollingSubscription.ts # Real-time updates
│   │   └── supabase/
│   │       ├── client.ts          # Supabase client setup
│   │       └── info.tsx           # Project config
│   └── styles/
│       └── globals.css            # Global styles + Tailwind
├── supabase/
│   ├── functions/server/
│   │   ├── index.tsx              # Main Hono server
│   │   ├── db.tsx                 # Database functions
│   │   ├── steam.tsx              # Steam API integration
│   │   └── kv_store.tsx           # Key-value store (protected)
│   └── migrations/
│       └── 20240101000000_initial_schema.sql
├── .env.local                     # Environment variables (not committed)
├── .env.example                   # Template
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── README.md
```

---

## 🗄️ Database Schema (PostgreSQL)

### 1. users
```sql
CREATE TABLE users (
  steam_id TEXT PRIMARY KEY,
  persona_name TEXT NOT NULL,
  avatar_url TEXT,
  profile_url TEXT,
  trade_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (steam_id = current_setting('app.steam_id', true));
```

### 2. offers
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_steam_id TEXT NOT NULL REFERENCES users(steam_id),
  offering JSONB NOT NULL DEFAULT '[]',
  seeking JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_offers_user ON offers(user_steam_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_created ON offers(created_at DESC);

-- RLS Policies
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active offers"
  ON offers FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "Users can create their own offers"
  ON offers FOR INSERT
  WITH CHECK (user_steam_id = current_setting('app.steam_id', true));

CREATE POLICY "Users can update their own offers"
  ON offers FOR UPDATE
  USING (user_steam_id = current_setting('app.steam_id', true));

CREATE POLICY "Users can delete their own offers"
  ON offers FOR DELETE
  USING (user_steam_id = current_setting('app.steam_id', true));
```

### 3. trade_requests
```sql
CREATE TABLE trade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  requester_steam_id TEXT NOT NULL REFERENCES users(steam_id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trade_requests_offer ON trade_requests(offer_id);
CREATE INDEX idx_trade_requests_requester ON trade_requests(requester_steam_id);

-- RLS Policies
ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read requests they sent or received"
  ON trade_requests FOR SELECT
  USING (
    requester_steam_id = current_setting('app.steam_id', true) OR
    offer_id IN (
      SELECT id FROM offers WHERE user_steam_id = current_setting('app.steam_id', true)
    )
  );

CREATE POLICY "Users can create trade requests"
  ON trade_requests FOR INSERT
  WITH CHECK (requester_steam_id = current_setting('app.steam_id', true));

CREATE POLICY "Offer owners can update request status"
  ON trade_requests FOR UPDATE
  USING (
    offer_id IN (
      SELECT id FROM offers WHERE user_steam_id = current_setting('app.steam_id', true)
    )
  );
```

### 4. user_reputation
```sql
CREATE TABLE user_reputation (
  steam_id TEXT PRIMARY KEY REFERENCES users(steam_id),
  completion_rate DECIMAL(5,2) DEFAULT 0.00,
  total_votes INTEGER DEFAULT 0,
  positive_votes INTEGER DEFAULT 0,
  negative_votes INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reputation"
  ON user_reputation FOR SELECT
  USING (true);
```

### 5. inventory_cache
```sql
CREATE TABLE inventory_cache (
  steam_id TEXT PRIMARY KEY REFERENCES users(steam_id),
  inventory_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE inventory_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own cache"
  ON inventory_cache FOR SELECT
  USING (steam_id = current_setting('app.steam_id', true));
```

### 6. steam_auth_tokens
```sql
CREATE TABLE steam_auth_tokens (
  session_id TEXT PRIMARY KEY,
  steam_id TEXT NOT NULL REFERENCES users(steam_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_steam_auth_tokens_steam_id ON steam_auth_tokens(steam_id);
CREATE INDEX idx_steam_auth_tokens_expires ON steam_auth_tokens(expires_at);

-- RLS Policies (service role only)
ALTER TABLE steam_auth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access"
  ON steam_auth_tokens
  USING (false);
```

### 7. notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_steam_id TEXT NOT NULL REFERENCES users(steam_id),
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_steam_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (user_steam_id = current_setting('app.steam_id', true));

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_steam_id = current_setting('app.steam_id', true));
```

### 8. kv_store_e2cf3727
```sql
CREATE TABLE kv_store_e2cf3727 (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (service role only)
ALTER TABLE kv_store_e2cf3727 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access"
  ON kv_store_e2cf3727
  USING (false);
```

---

## 🔑 TypeScript Types

```typescript
// components/types.ts

export type ItemRarity = 
  | 'consumer' 
  | 'industrial' 
  | 'milspec' 
  | 'restricted' 
  | 'classified' 
  | 'covert' 
  | 'gold';

export type ItemWear = 
  | 'Factory New' 
  | 'Minimal Wear' 
  | 'Field-Tested' 
  | 'Well-Worn' 
  | 'Battle-Scarred';

export interface TradeItem {
  id: string;
  name: string;
  image?: string;
  rarity?: ItemRarity;
  wear?: ItemWear;
  float?: number;
  statTrak?: boolean;
  assetId?: string;
  isPlaceholder?: boolean;
  category?: 'knife' | 'offers' | 'cases';
}

export interface TradeOffer {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userSteamId: string;
  userTradeUrl?: string;
  offering: TradeItem[];
  seeking: TradeItem[];
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  timestamp: number;
  createdAt?: string;
}

export interface TradeRequest {
  id: string;
  offerId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  offer?: TradeOffer;
}

export interface SteamUser {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  tradeUrl?: string;
}

export interface InventoryItem extends TradeItem {
  amount?: number;
  tradable?: boolean;
}
```

---

## 🎯 API Endpoints (Supabase Edge Function)

**Base URL**: `https://{project-id}.supabase.co/functions/v1/make-server-e2cf3727`

### Authentication
All endpoints use:
- **Header**: `Authorization: Bearer {supabase_anon_key}`
- **Session Header**: `X-Session-ID: {session_id}` (for authenticated requests)

### Endpoints

#### Offers
```
GET    /offers/list               # Get all active offers
GET    /offers/:id                # Get single offer
POST   /offers/create             # Create new offer
       Body: { offering: TradeItem[], seeking: TradeItem[], notes?: string }
PUT    /offers/:id                # Update offer
       Body: { offering: TradeItem[], seeking: TradeItem[], notes?: string }
DELETE /offers/:id                # Delete offer
GET    /offers/user/mine          # Get authenticated user's offers
```

#### Trade Requests
```
POST   /offers/:id/request        # Send trade request
       Body: { message?: string }
GET    /requests/received         # Get requests received
GET    /requests/sent             # Get requests sent
PUT    /requests/:id              # Update request status
       Body: { status: 'accepted' | 'declined' }
```

#### Inventory
```
GET    /inventory/:steamId        # Get user's CS2 inventory (cached)
```

#### User
```
GET    /user/profile              # Get own profile
PUT    /user/profile              # Update profile
       Body: { personaName?: string, tradeUrl?: string }
PUT    /user/trade-url            # Update trade URL
       Body: { tradeUrl: string }
```

#### Auth
```
POST   /auth/steam                # Initiate Steam OAuth
GET    /auth/callback             # Steam OAuth callback
POST   /auth/logout               # Logout
```

---

## 📝 Core Component Code

### 1. App.tsx (Main Router)

```typescript
import { useState } from 'react';
import { MarketplaceFeed } from './components/MarketplaceFeed';
import { Dashboard } from './components/Dashboard';
import { getSteamUser } from './utils/steamAuth';
import type { SteamUser } from './components/types';

export type Page = 'marketplace' | 'dashboard';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('marketplace');
  const [user, setUser] = useState<SteamUser | null>(getSteamUser());

  const handleLogin = (steamUser: SteamUser) => {
    setUser(steamUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('steam_user');
    localStorage.removeItem('steam_session_id');
    setUser(null);
    setCurrentPage('marketplace');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      {currentPage === 'marketplace' && (
        <MarketplaceFeed
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === 'dashboard' && user && (
        <Dashboard
          user={user}
          onNavigate={setCurrentPage}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
```

### 2. MarketplaceFeed.tsx (Homepage)

Key features:
- Header with logo, search, auth buttons
- Filter bar (status, rarity)
- Grid of OfferCard components
- Create Offer button (opens modal)
- Polling for real-time updates (5 second interval)
- Loading states and empty states

Structure:
```typescript
export function MarketplaceFeed({ user, onLogin, onLogout, onNavigate }) {
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  
  // Fetch offers on mount
  useEffect(() => {
    fetchOffers();
  }, []);
  
  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchOffers, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-lg border-b border-[var(--bg-elevated)]">
        {/* Logo, Search, Auth Buttons */}
      </header>
      
      {/* Offer Grid */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-6">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} onViewDetails={setSelectedOffer} />
          ))}
        </div>
      </main>
      
      {/* Modals */}
      {showCreateModal && <CreateOfferModal onClose={...} onCreateOffer={...} />}
      {selectedOffer && <OfferDetailView offer={selectedOffer} onClose={...} />}
    </div>
  );
}
```

### 3. OfferCard.tsx (Trade Offer Display)

Key features:
- User avatar and name
- Time ago display
- Two columns: "Offering" and "Seeking"
- Grid of items with rarity-colored borders
- **Placeholder detection** by item name
- "Send Offer" button (opens Steam trade URL)
- "View Details" button

**CRITICAL: Placeholder Detection Logic**
```typescript
// Map placeholder names to images
const PLACEHOLDER_MAP: Record<string, string> = {
  'Any Knife': '/assets/any-knife.png',
  'Any Offers': '/assets/any-offers.png',
  'Any Cases': '/assets/any-cases.png'
};

// Check if item is placeholder based on name
function getPlaceholderImage(itemName: string): string | null {
  return PLACEHOLDER_MAP[itemName] || null;
}

// In ItemDisplay component:
function ItemDisplay({ item }: { item: TradeItem }) {
  const placeholderImage = getPlaceholderImage(item.name);
  
  if (placeholderImage) {
    return (
      <div className="w-32 h-32 bg-[var(--bg-elevated)] rounded-lg border-2 border-dashed border-[var(--electric-blue)]">
        <img src={placeholderImage} alt={item.name} />
      </div>
    );
  }
  
  // Regular item display with rarity border...
}
```

### 4. CreateOfferModal.tsx (Offer Creation)

Multi-step flow:
1. **Select Offering** - Choose items from inventory or add placeholders
2. **Select Seeking** - Same
3. **Review & Submit** - Add notes, preview, submit

Key features:
- Inventory selector with Steam API integration
- Placeholder buttons (Any Knife, Any Offers, Any Cases)
- Notes textarea
- Step navigation
- Loading states during submission

Structure:
```typescript
export function CreateOfferModal({ onClose, onCreateOffer }) {
  const [step, setStep] = useState<'offering' | 'seeking' | 'review'>('offering');
  const [selectedOffering, setSelectedOffering] = useState<TradeItem[]>([]);
  const [selectedSeeking, setSelectedSeeking] = useState<TradeItem[]>([]);
  const [notes, setNotes] = useState('');
  const [showInventorySelector, setShowInventorySelector] = useState(false);
  
  const handleSubmit = async () => {
    const offer = await createOffer(selectedOffering, selectedSeeking, notes);
    onCreateOffer(offer);
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-[var(--bg-base)] rounded-xl p-6 max-w-4xl w-full">
        {/* Step content */}
        {step === 'offering' && <SelectItems mode="offering" />}
        {step === 'seeking' && <SelectItems mode="seeking" />}
        {step === 'review' && <ReviewStep />}
      </div>
    </div>
  );
}
```

### 5. Dashboard.tsx (User Dashboard)

Tabs:
- **My Offers** - User's active offers (with edit/delete)
- **Received Requests** - Trade requests from others
- **Sent Requests** - Trade requests user sent

Key features:
- Tab navigation
- Editable offer cards
- Accept/decline trade requests
- Empty states for each tab

### 6. InventorySelector.tsx (Steam Inventory)

Key features:
- Fetches user's CS2 inventory from Steam API
- Grid display of items
- Click to select/deselect
- Loading skeleton
- Error handling for API failures
- Cached for 1 hour

---

## 🎨 Styles (globals.css)

```css
@import "tailwindcss";

/* CSS Variables */
:root {
  /* Colors */
  --cs-orange: #FF6A00;
  --cs-orange-bright: #FF8533;
  --electric-blue: #00D9FF;
  --electric-blue-dim: #00B8D4;
  
  --bg-deep: #0f1419;
  --bg-base: #1B2838;
  --bg-elevated: #2a475e;
  --bg-overlay: rgba(27, 40, 56, 0.95);
  
  --text-primary: #ffffff;
  --text-secondary: #b8b6b4;
  --text-tertiary: #8b8a88;
  
  --rarity-consumer: #b0c3d9;
  --rarity-industrial: #5e98d9;
  --rarity-milspec: #4b69ff;
  --rarity-restricted: #8847ff;
  --rarity-classified: #d32ce6;
  --rarity-covert: #eb4b4b;
  --rarity-gold: #e4ae39;
}

/* Base Styles */
body {
  background: var(--bg-deep);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Glow Effects */
.glow-orange {
  box-shadow: 0 0 20px rgba(255, 106, 0, 0.3);
}

.glow-blue {
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-base);
}

::-webkit-scrollbar-thumb {
  background: var(--bg-elevated);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--electric-blue);
}
```

---

## 🔧 Utility Functions

### steamAuth.ts (Frontend)

```typescript
export interface SteamUser {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  tradeUrl?: string;
}

export function getSteamUser(): SteamUser | null {
  const userStr = localStorage.getItem('steam_user');
  if (!userStr) return null;
  return JSON.parse(userStr);
}

export function getSessionId(): string | null {
  return localStorage.getItem('steam_session_id');
}

export function saveSteamUser(user: SteamUser, sessionId: string): void {
  localStorage.setItem('steam_user', JSON.stringify(user));
  localStorage.setItem('steam_session_id', sessionId);
}

export function clearSteamUser(): void {
  localStorage.removeItem('steam_user');
  localStorage.removeItem('steam_session_id');
}

// Initiate Steam OAuth
export async function loginWithSteam(): Promise<void> {
  const authUrl = `${SERVER_URL}/auth/steam`;
  window.location.href = authUrl;
}
```

### offerApi.ts (Frontend API Client)

```typescript
import { projectId, publicAnonKey } from './supabase/info';
import { getSessionId } from './steamAuth';
import type { TradeOffer } from '../components/types';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e2cf3727`;

export async function createOffer(
  offering: any[],
  seeking: any[],
  notes?: string
): Promise<TradeOffer> {
  const sessionId = getSessionId();
  if (!sessionId) throw new Error('Not authenticated');

  const response = await fetch(`${SERVER_URL}/offers/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'X-Session-ID': sessionId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ offering, seeking, notes }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create offer');
  }

  const data = await response.json();
  return data.offer;
}

export async function getAllOffers(): Promise<TradeOffer[]> {
  const response = await fetch(`${SERVER_URL}/offers/list`, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch offers');

  const data = await response.json();
  return data.offers || [];
}

// Similar functions for updateOffer, deleteOffer, getMyOffers, etc.
```

---

## 🚀 Backend (Supabase Edge Function)

### index.tsx (Hono Server)

```typescript
import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import * as db from './db.tsx';
import { getSteamInventory } from './steam.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Session validation middleware
async function validateSession(sessionId: string): Promise<string | null> {
  const session = await db.getSessionBySteamId(sessionId);
  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }
  return session.steam_id;
}

// Routes
app.get('/make-server-e2cf3727/offers/list', async (c) => {
  try {
    const offers = await db.getAllOffers();
    return c.json({ offers });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return c.json({ error: 'Failed to fetch offers' }, 500);
  }
});

app.post('/make-server-e2cf3727/offers/create', async (c) => {
  const sessionId = c.req.header('X-Session-ID');
  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const steamId = await validateSession(sessionId);
  if (!steamId) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  try {
    const { offering, seeking, notes } = await c.req.json();
    
    // Validate input
    if (!Array.isArray(offering) || !Array.isArray(seeking)) {
      return c.json({ error: 'Invalid input' }, 400);
    }

    const offer = await db.createOffer(steamId, offering, seeking, notes);
    return c.json({ offer }, 201);
  } catch (error) {
    console.error('Error creating offer:', error);
    return c.json({ error: 'Failed to create offer' }, 500);
  }
});

// More routes for PUT, DELETE, trade requests, inventory, etc.

Deno.serve(app.fetch);
```

### db.tsx (Database Functions)

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(supabaseUrl, supabaseKey);

export async function createOffer(
  steamId: string,
  offering: any[],
  seeking: any[],
  notes?: string
) {
  const { data, error } = await db
    .from('offers')
    .insert({
      user_steam_id: steamId,
      offering,
      seeking,
      notes: notes || null,
      status: 'active',
    })
    .select(`
      *,
      user:users!user_steam_id (
        steam_id,
        persona_name,
        avatar_url,
        profile_url,
        trade_url
      )
    `)
    .single();

  if (error) throw new Error(`Failed to create offer: ${error.message}`);
  
  return transformOfferFromDb(data);
}

export async function getAllOffers() {
  const { data, error } = await db
    .from('offers')
    .select(`
      *,
      user:users!user_steam_id (
        steam_id,
        persona_name,
        avatar_url,
        profile_url,
        trade_url
      )
    `)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch offers: ${error.message}`);
  
  return data.map(transformOfferFromDb);
}

function transformOfferFromDb(dbOffer: any) {
  return {
    id: dbOffer.id,
    userId: dbOffer.user_steam_id,
    userName: dbOffer.user.persona_name,
    userAvatar: dbOffer.user.avatar_url,
    userSteamId: dbOffer.user.steam_id,
    userTradeUrl: dbOffer.user.trade_url,
    offering: dbOffer.offering,
    seeking: dbOffer.seeking,
    notes: dbOffer.notes,
    status: dbOffer.status,
    timestamp: new Date(dbOffer.created_at).getTime(),
    createdAt: dbOffer.created_at,
  };
}

// More functions: updateOffer, deleteOffer, getUserOffers, etc.
```

### steam.tsx (Steam API Integration)

```typescript
const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY');

export async function getSteamInventory(steamId: string) {
  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=5000`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Steam API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform items
    const items = data.descriptions.map((desc: any) => ({
      id: desc.classid,
      name: desc.market_hash_name,
      image: `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}`,
      rarity: extractRarity(desc.tags),
      wear: extractWear(desc.market_hash_name),
      tradable: desc.tradable === 1,
    }));
    
    return items;
  } catch (error) {
    console.error('Error fetching Steam inventory:', error);
    throw error;
  }
}

function extractRarity(tags: any[]): string | undefined {
  const rarityTag = tags?.find(t => t.category === 'Rarity');
  if (!rarityTag) return undefined;
  
  const rarityMap: Record<string, string> = {
    'Rarity_Common': 'consumer',
    'Rarity_Uncommon': 'industrial',
    'Rarity_Rare': 'milspec',
    'Rarity_Mythical': 'restricted',
    'Rarity_Legendary': 'classified',
    'Rarity_Ancient': 'covert',
    'Rarity_Contraband': 'gold',
  };
  
  return rarityMap[rarityTag.internal_name];
}

function extractWear(name: string): string | undefined {
  if (name.includes('Factory New')) return 'Factory New';
  if (name.includes('Minimal Wear')) return 'Minimal Wear';
  if (name.includes('Field-Tested')) return 'Field-Tested';
  if (name.includes('Well-Worn')) return 'Well-Worn';
  if (name.includes('Battle-Scarred')) return 'Battle-Scarred';
  return undefined;
}
```

---

## ⚙️ Configuration Files

### package.json
```json
{
  "name": "cs-trading-hub",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "latest",
    "sonner": "^2.0.3",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### .env.example
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STEAM_API_KEY=your_steam_api_key
```

---

## 🎯 Implementation Checklist for Cursor AI

### Phase 1: Project Setup
- [ ] Create new React + TypeScript + Vite project
- [ ] Install dependencies (React, Tailwind v4, Lucide, Sonner)
- [ ] Set up file structure as specified
- [ ] Configure Tailwind CSS v4 in globals.css
- [ ] Create all TypeScript types in components/types.ts

### Phase 2: UI Components
- [ ] Create basic UI components (Button, Input, Textarea, Card)
- [ ] Style with Tailwind using design system colors
- [ ] Add hover effects and transitions

### Phase 3: Core Pages
- [ ] Build MarketplaceFeed component
- [ ] Build OfferCard component with placeholder detection
- [ ] Build CreateOfferModal with multi-step flow
- [ ] Build Dashboard component with tabs
- [ ] Build OfferDetailView component
- [ ] Build InventorySelector component

### Phase 4: Authentication
- [ ] Set up Steam OAuth flow in utils/steamAuth.ts
- [ ] Create login/logout functions
- [ ] Handle session management with localStorage
- [ ] Add auth headers to API calls

### Phase 5: API Integration
- [ ] Create offerApi.ts with all API functions
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Set up polling subscription (5 second interval)

### Phase 6: Backend (Supabase)
- [ ] Create Supabase project
- [ ] Run all database migrations
- [ ] Set up Row Level Security policies
- [ ] Create Edge Function with Hono server
- [ ] Implement all API endpoints
- [ ] Add Steam API integration
- [ ] Deploy Edge Function

### Phase 7: Polish
- [ ] Add loading skeletons
- [ ] Add empty states
- [ ] Add error messages with toast notifications
- [ ] Test all user flows
- [ ] Add responsive design for mobile
- [ ] Optimize performance

---

## 🚨 Critical Implementation Notes

### 1. Placeholder Item Detection
**MUST implement name-based detection, NOT database field-based:**

```typescript
const PLACEHOLDER_MAP = {
  'Any Knife': '/assets/any-knife.png',
  'Any Offers': '/assets/any-offers.png',
  'Any Cases': '/assets/any-cases.png'
};

function isPlaceholder(itemName: string): boolean {
  return itemName in PLACEHOLDER_MAP;
}
```

### 2. RLS Policies
Database security is CRITICAL. All tables must have:
- `ENABLE ROW LEVEL SECURITY`
- Policies for SELECT, INSERT, UPDATE, DELETE
- Use `current_setting('app.steam_id', true)` for user context

### 3. Session Management
- Store in localStorage: `steam_user` and `steam_session_id`
- Include `X-Session-ID` header in authenticated requests
- Validate session on server before operations

### 4. Steam API Caching
- Cache inventory for 1 hour
- Check cache before fetching from Steam
- Handle Steam API rate limits and errors

### 5. Real-time Updates
- Use polling (5 second interval) by default
- Can upgrade to Supabase Realtime later
- Clear interval on component unmount

---

## 📦 Assets Needed

### Placeholder Images (3 files)
Place in `/public/assets/`:

1. **any-knife.png** - Generic knife silhouette
2. **any-offers.png** - Question mark or generic icon
3. **any-cases.png** - Case/box icon

User can provide these or use placeholder URLs temporarily.

---

## 🔐 Environment Variables Required

```env
# Frontend (.env.local)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Backend (Supabase Secrets)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STEAM_API_KEY=ABC...
```

---

## ✅ Final Testing Checklist

- [ ] Can login with Steam
- [ ] Can create offer with real items
- [ ] Can create offer with placeholder items
- [ ] Placeholder images display correctly
- [ ] Can edit own offer
- [ ] Can delete own offer
- [ ] Can view other offers
- [ ] Can send trade request
- [ ] Can view received requests in dashboard
- [ ] Real-time updates work (new offers appear)
- [ ] Steam inventory loads
- [ ] Trade URL can be set
- [ ] Responsive on mobile
- [ ] No console errors

---

## 🎮 You're Ready to Build!

This document contains everything needed to recreate CS Trading Hub from scratch. Use Cursor AI to help implement each component following these specifications exactly.

**Start with Phase 1 and work through sequentially. Good luck!** 🚀
