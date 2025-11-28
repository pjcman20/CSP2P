# CS Trading Hub - Architecture Documentation

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│                    React + TypeScript                       │
│                      Tailwind CSS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Marketplace │  │   Dashboard  │  │  Offer Detail   │   │
│  │    Feed     │  │              │  │      View       │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            Component Library (UI)                   │   │
│  │   Button, Input, Card, Modal, Textarea, etc.       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       │ (Authorization: Bearer token)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    SUPABASE BACKEND                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Edge Function (Deno Runtime)                  │ │
│  │         /make-server-e2cf3727/*                       │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │                                                       │ │
│  │  ┌─────────────────┐      ┌──────────────────────┐  │ │
│  │  │  Hono Router    │      │   Steam API Client   │  │ │
│  │  │                 │      │                      │  │ │
│  │  │ /offers/*       │──────│  Fetch Inventories   │  │ │
│  │  │ /requests/*     │      │  Validate Users      │  │ │
│  │  │ /inventory/*    │      │                      │  │ │
│  │  │ /auth/*         │      └──────────────────────┘  │ │
│  │  └─────────────────┘                                │ │
│  │                                                       │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │         Database Layer (db.tsx)                │  │ │
│  │  │                                                │  │ │
│  │  │  • createOffer()                              │  │ │
│  │  │  • getUserOffers()                            │  │ │
│  │  │  • sendTradeRequest()                         │  │ │
│  │  │  • cacheInventory()                           │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Supabase Auth (Steam OAuth)              │ │
│  │  ┌───────────���──┐    ┌───────────────────────────┐   │ │
│  │  │ Steam OpenID │───▶│ JWT Token Generation      │   │ │
│  │  └──────────────┘    └───────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │        PostgreSQL Database (with RLS)                 │ │
│  │                                                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐    │ │
│  │  │  users   │  │  offers  │  │ trade_requests  │    │ │
│  │  └──────────┘  └──────────┘  └─────────────────┘    │ │
│  │                                                       │ │
│  │  ┌────────────────┐  ┌───────────────────────────┐  │ │
│  │  │ inventory_cache│  │  user_reputation          │  │ │
│  │  └────────────────┘  └───────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌────────────────┐  ┌───────────────────────────┐  │ │
│  │  │ notifications  │  │  steam_auth_tokens        │  │ │
│  │  └────────────────┘  └───────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │         kv_store_e2cf3727                      │  │ │
│  │  │         (Generic Key-Value Store)              │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/REST
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   EXTERNAL APIS                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────┐    ┌───────────────────────┐   │
│  │  Steam Web API         │    │   Steam OpenID        │   │
│  │                        │    │                       │   │
│  │  • GetPlayerInventory  │    │   • Authentication    │   │
│  │  • GetPlayerSummaries  │    │   • User Profile      │   │
│  │  • GetSchema          │    │                       │   │
│  └────────────────────────┘    └───────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. User Authentication Flow

```
User clicks "Sign in with Steam"
    ↓
Frontend redirects to Steam OpenID
    ↓
User authenticates on Steam
    ↓
Steam redirects back with OpenID response
    ↓
Supabase Auth validates & creates session
    ↓
Frontend stores JWT token
    ↓
Frontend includes token in all API requests
```

### 2. Create Offer Flow

```
User opens Create Offer modal
    ↓
User selects items from inventory
    (OR adds placeholder items like "Any Knife")
    ↓
User adds notes & submits
    ↓
Frontend: POST /offers/create
    with: { offering: [], seeking: [], notes: "" }
    headers: { X-Session-ID: sessionId }
    ↓
Edge Function validates session
    ↓
Edge Function fetches user from steam_auth_tokens
    ↓
Edge Function calls db.createOffer()
    ↓
Database inserts into offers table (with RLS check)
    ↓
Edge Function returns created offer
    ↓
Frontend adds offer to local state
    ↓
Other users see new offer via polling
```

### 3. Browse & Send Trade Request Flow

```
User browses marketplace feed
    ↓
Frontend: GET /offers/list
    ↓
Edge Function calls db.getAllOffers()
    ↓
Database returns offers with user data (join)
    ↓
Frontend renders OfferCard components
    ↓
User clicks "Send Offer" button
    ↓
Opens Steam trade URL in new tab
    (OR sends in-app trade request)
    ↓
Frontend: POST /offers/{id}/request
    with: { message: "..." }
    ↓
Edge Function creates trade_request record
    ↓
Database inserts with RLS check
    ↓
Recipient sees request in dashboard
```

### 4. Inventory Fetch Flow

```
User opens inventory selector
    ↓
Frontend: GET /inventory/{steamId}
    ↓
Edge Function checks inventory_cache table
    ↓
If cached & fresh (< 1 hour):
    Return cached inventory
    ↓
If stale or missing:
    Call Steam Web API: GetPlayerInventory
    ↓
    Parse items & save to cache
    ↓
    Return fresh inventory
    ↓
Frontend displays items in selector
```

---

## 📦 Component Hierarchy

```
App.tsx (Main Router)
│
├── MarketplaceFeed.tsx (Homepage)
│   ├── Header (Logo, Auth, Create Offer)
│   ├── SearchBar & Filters
│   ├── OfferCard[] (List of offers)
│   │   ├── UserInfo
│   │   ├── ItemDisplay[] (Offering)
│   │   ├── ItemDisplay[] (Seeking)
│   │   └── Actions (Send Offer, View Details)
│   │
│   ├── CreateOfferModal
│   │   ├── InventorySelector
│   │   │   └── ItemCard[]
│   │   ├── PlaceholderOptions
│   │   └── ReviewStep
│   │
│   └── OfferDetailView
│       ├── FullItemDetails
│       ├── UserReputation
│       └── SendTradeRequestForm
│
├── Dashboard.tsx (User's Offers & Requests)
│   ├── MyOffersTab
│   │   └── OfferCard[] (Editable)
│   ├── ReceivedRequestsTab
│   │   └── TradeRequestCard[]
│   └── SentRequestsTab
│       └── TradeRequestCard[]
│
└── UI Components
    ├── Button
    ├── Input
    ├── Textarea
    ├── Modal
    ├── Card
    └── Badge
```

---

## 🗄️ Database Schema

### users
```sql
steam_id (TEXT, PK)
persona_name (TEXT)
avatar_url (TEXT)
profile_url (TEXT)
trade_url (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**RLS**: Users can read all, update only their own row.

---

### offers
```sql
id (UUID, PK)
user_steam_id (TEXT, FK → users)
offering (JSONB) -- Array of TradeItem objects
seeking (JSONB) -- Array of TradeItem objects
notes (TEXT)
status (TEXT) -- 'active' | 'completed' | 'cancelled'
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
deleted_at (TIMESTAMP)
```

**RLS**: Users can read active offers, create/update/delete only their own.

---

### trade_requests
```sql
id (UUID, PK)
offer_id (UUID, FK → offers)
requester_steam_id (TEXT, FK → users)
message (TEXT)
status (TEXT) -- 'pending' | 'accepted' | 'declined'
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**RLS**: Users can read requests they sent or received, create their own.

---

### inventory_cache
```sql
steam_id (TEXT, PK)
inventory_data (JSONB) -- Array of items from Steam API
cached_at (TIMESTAMP)
```

**RLS**: Users can read their own cache, service role manages updates.

---

### user_reputation
```sql
steam_id (TEXT, PK, FK → users)
completion_rate (DECIMAL) -- % of trades completed
total_votes (INTEGER)
positive_votes (INTEGER)
negative_votes (INTEGER)
updated_at (TIMESTAMP)
```

**RLS**: All users can read, only authenticated can vote (via function).

---

### steam_auth_tokens
```sql
session_id (TEXT, PK)
steam_id (TEXT, FK → users)
created_at (TIMESTAMP)
expires_at (TIMESTAMP)
```

**RLS**: Only service role can access (for auth validation).

---

### notifications
```sql
id (UUID, PK)
user_steam_id (TEXT, FK → users)
type (TEXT) -- 'trade_request' | 'offer_matched' | etc.
content (JSONB)
read (BOOLEAN)
created_at (TIMESTAMP)
```

**RLS**: Users can read/update only their own notifications.

---

### kv_store_e2cf3727
```sql
key (TEXT, PK)
value (JSONB)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**RLS**: Only service role can access (generic storage).

---

## 🔐 Security Model

### Authentication
- **Steam OpenID** via Supabase Auth
- **JWT tokens** stored in session
- **Session validation** via `X-Session-ID` header

### Authorization
- **Row Level Security (RLS)** on all tables
- **Service role** for admin operations
- **User role** for authenticated requests

### Data Protection
- **Input validation** on all endpoints
- **SQL injection prevention** via parameterized queries
- **XSS prevention** via React's built-in escaping
- **CORS headers** properly configured

See `/SECURITY_ROADMAP.md` for complete security checklist.

---

## 🚀 API Endpoints

### Offers
```
GET    /make-server-e2cf3727/offers/list           # Get all offers
GET    /make-server-e2cf3727/offers/:id            # Get single offer
POST   /make-server-e2cf3727/offers/create         # Create offer
PUT    /make-server-e2cf3727/offers/:id            # Update offer
DELETE /make-server-e2cf3727/offers/:id            # Delete offer
GET    /make-server-e2cf3727/offers/user/mine      # Get user's offers
```

### Trade Requests
```
POST   /make-server-e2cf3727/offers/:id/request    # Send trade request
GET    /make-server-e2cf3727/requests/received     # Get received requests
GET    /make-server-e2cf3727/requests/sent         # Get sent requests
PUT    /make-server-e2cf3727/requests/:id          # Update request status
```

### Inventory
```
GET    /make-server-e2cf3727/inventory/:steamId    # Get user inventory
POST   /make-server-e2cf3727/inventory/refresh     # Force refresh cache
```

### User
```
GET    /make-server-e2cf3727/user/profile          # Get own profile
PUT    /make-server-e2cf3727/user/profile          # Update profile
PUT    /make-server-e2cf3727/user/trade-url        # Update trade URL
```

---

## 📊 Performance Considerations

### Caching Strategy
- **Inventory cache**: 1 hour TTL
- **Offer list**: Polling every 5 seconds (can switch to WebSocket)
- **User profiles**: Fetched with offers (joined query)

### Database Optimization
- **Indexes** on frequently queried columns (steam_id, offer_id, status)
- **JSONB queries** optimized with GIN indexes
- **Soft deletes** via `deleted_at` column

### Frontend Optimization
- **Code splitting** via React.lazy() (not yet implemented)
- **Image optimization** via lazy loading
- **Debounced search** to reduce API calls

---

## 🔄 Real-time Updates

### Current: Polling
- Poll `/offers/list` every 5 seconds
- Simple, works everywhere
- See `/utils/pollingSubscription.ts`

### Alternative: Supabase Realtime (Disabled)
- WebSocket-based subscriptions
- More efficient for high traffic
- See `/utils/realtimeSubscription.ts` (commented out)

To enable:
1. Uncomment realtime subscription in `MarketplaceFeed.tsx`
2. Enable Realtime in Supabase Dashboard
3. Configure RLS for Realtime

---

## 🧪 Testing Strategy

### Manual Testing
- Test each user flow end-to-end
- Check browser console for errors
- Verify database records in Supabase

### Automated Testing (Not Yet Implemented)
- Unit tests for utility functions
- Integration tests for API endpoints
- E2E tests for critical flows

---

## 📈 Scalability Considerations

### Current State (Prototype)
- Single Supabase project
- Polling-based updates
- No caching layer
- ✅ Good for: 100-1000 users

### Production Ready (Recommended)
- CDN for static assets
- Redis for session caching
- WebSocket for real-time
- Rate limiting per user
- ✅ Good for: 10,000+ users

### High Scale (Future)
- Separate read/write databases
- Microservices architecture
- Kafka for event streaming
- Elasticsearch for search
- ✅ Good for: 100,000+ users

---

## 🛠️ Development Workflow

### Local Development
```bash
npm run dev           # Start frontend
supabase functions serve  # Start edge functions locally
```

### Debugging
- Browser DevTools for frontend
- Supabase Dashboard for backend logs
- PostgreSQL logs for database

### Deployment
```bash
npm run build         # Build frontend
supabase functions deploy  # Deploy backend
supabase db push      # Apply migrations
```

---

## 📚 Further Reading

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Hono Framework**: [hono.dev](https://hono.dev)
- **Steam API**: [steamcommunity.com/dev](https://steamcommunity.com/dev)
- **Row Level Security**: [supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated**: Ready for Cursor export
**Status**: Production-ready with known issues documented
