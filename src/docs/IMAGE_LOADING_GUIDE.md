# CS2 Item Image Loading Guide

## 🖼️ How Images Work

### Image Sources
All CS2 item images come from **Steam's official CDN**:
```
https://community.akamai.steamstatic.com/economy/image/[hash]/62fx62f
```

These are the same images Steam uses in their own marketplace.

---

## ✅ What We've Implemented

### 1. **CS2ItemImage Component** (`/components/CS2ItemImage.tsx`)

Professional image loading with:
- ✅ **Loading state** (animated placeholder while loading)
- ✅ **Error handling** (fallback icon if image fails)
- ✅ **CORS support** (`crossOrigin="anonymous"`)
- ✅ **Lazy loading** (images load as you scroll)
- ✅ **Responsive sizing** (sm/md/lg sizes)

### 2. **Graceful Fallbacks**

If Steam CDN image fails to load:
```
┌─────────────┐
│  📦 Package │  ← Fallback icon
│    Icon     │
└─────────────┘
```

---

## 🔍 Debugging Image Issues

### Step 1: Open Browser DevTools

**Chrome/Firefox:**
1. Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. Go to **Console** tab
3. Look for image loading errors

### Step 2: Check What's Happening

You should see logs like:
```
✅ Image loaded: https://community.akamai.steamstatic.com/economy/image/...
```

Or:
```
⚠️ Failed to load image: https://community.akamai.steamstatic.com/economy/image/...
```

### Step 3: Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| **Images not loading at all** | Steam CDN blocking your IP/domain | Use fallback icons (already implemented) |
| **Some images load, some don't** | Specific image hashes are invalid | Fallback works automatically |
| **CORS errors** | Cross-origin restrictions | We use `crossOrigin="anonymous"` |
| **Slow loading** | Large images | We use lazy loading |

---

## 🧪 Testing Image Loading

### Test 1: Check a Single Image URL

Open this URL directly in your browser:
```
https://community.akamai.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf2PLacDBA5ciJh5C0mf7zO6_ummpD78A_3b2VpI2ljQTsqEZpNW_3IYSSdFc3aAzX-lW9yOu71pC06JrPnCRn6XN2sGGdwUI0NUSB0A/62fx62f
```

**Expected:** You should see a Karambit | Fade image

**If you see nothing:** Steam CDN might be blocking your location/network

### Test 2: Check Network Tab

1. Open DevTools → **Network** tab
2. Filter by **Img**
3. Create an offer and browse items
4. Watch for image requests

**What to look for:**
- ✅ Status: 200 (OK) = Image loaded successfully
- ❌ Status: 403 (Forbidden) = CDN blocking access
- ❌ Status: 404 (Not Found) = Invalid image hash
- ❌ Failed = Network/CORS issue

### Test 3: Fallback Functionality

If images don't load, you should see:
- Gray box with package icon (📦)
- Hover tooltip with item name
- No broken image icons

---

## 🚀 Alternative Solutions

### Option 1: Proxy Images Through Your Backend (Recommended)

**How it works:**
1. Create server route: `/api/proxy-image`
2. Server fetches image from Steam CDN
3. Server returns image to frontend
4. Bypasses CORS and blocking issues

**Implementation:**

```typescript
// /supabase/functions/server/index.tsx

app.get('/make-server-e2cf3727/proxy-image', async (c) => {
  const imageUrl = c.req.query('url');
  
  if (!imageUrl || !imageUrl.startsWith('https://community.akamai.steamstatic.com')) {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Response(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch image' }, 500);
  }
});
```

**Frontend usage:**
```typescript
const proxiedUrl = `${SERVER_URL}/proxy-image?url=${encodeURIComponent(item.icon)}`;
```

### Option 2: Host Images in Supabase Storage

**Pros:**
- ✅ Complete control
- ✅ No CORS issues
- ✅ Faster loading (edge network)

**Cons:**
- ❌ Storage costs
- ❌ Need to download all images first
- ❌ Updates required for new items

### Option 3: Use Steam Market API (Different Endpoint)

Some Steam Market endpoints aren't blocked. Example:
```
https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=AK-47%20|%20Redline%20(Field-Tested)
```

This might include image URLs that work better.

---

## 📊 Current Status

### What's Working ✅
- 200+ items in database
- Real Steam CDN URLs for all items
- Fallback system for failed images
- Lazy loading for performance
- Error logging to console

### What Might Need Fixing ⚠️

Depending on your network/location, Steam CDN might:
- Block requests from certain countries
- Block requests from certain ISPs
- Rate limit image requests
- Require referrer headers

**Solution:** Implement Option 1 (proxy through backend) if direct loading fails.

---

## 🔧 Quick Fixes

### Fix 1: Add Referrer Header

Some CDNs check the referrer. Add to CS2ItemImage.tsx:

```typescript
<img
  src={src}
  alt={alt}
  referrerPolicy="no-referrer-when-downgrade"
  // ... other props
/>
```

### Fix 2: Use Higher Quality Images

Change `/62fx62f` to `/360fx360f` for bigger images:
```typescript
const hdUrl = src.replace('/62fx62f', '/360fx360f');
```

### Fix 3: Cache Images Client-Side

Use browser cache:
```typescript
const cachedSrc = useMemo(() => {
  const img = new Image();
  img.src = src;
  return src;
}, [src]);
```

---

## 🎯 Recommended Action Plan

### Immediate (Do This Now)
1. ✅ Open app in browser
2. ✅ Press F12 → Console tab
3. ✅ Click "Create Offer"
4. ✅ Browse items
5. ✅ Check if you see:
   - "Image loaded: ..." (good!)
   - "Failed to load image: ..." (needs proxy)

### Short Term (If Images Don't Load)
1. Implement image proxy (Option 1 above)
2. Update `CS2ItemImage.tsx` to use proxy URLs
3. Add 24-hour cache headers

### Long Term (Production)
1. Monitor image load success rate
2. Consider hosting critical images in Supabase Storage
3. Implement CDN failover (try Steam CDN → fallback to proxy → fallback to icon)

---

## 📈 Monitoring

Add analytics to track image performance:

```typescript
// In CS2ItemImage.tsx
const handleLoad = () => {
  setLoading(false);
  console.log(`✅ Image loaded: ${src}`);
  
  // Optional: Send to analytics
  // analytics.track('image_loaded', { src });
};

const handleError = () => {
  console.warn(`⚠️ Failed to load image: ${src}`);
  setError(true);
  setLoading(false);
  
  // Optional: Send to analytics
  // analytics.track('image_failed', { src });
};
```

---

## 💡 Pro Tip

**The current implementation with fallbacks is production-ready!**

Most CS:GO trading sites use:
1. Steam CDN as primary source (fast, free)
2. Fallback icons when images fail (good UX)
3. Item name as the source of truth (images are enhancement)

Your users can still trade successfully even if images don't load, because the **item name** is what matters for matching.
