# 🔍 Step-by-Step Image Debugging Guide

## Quick Start: Check if Images Are Loading

### Step 1: Open Your App
1. Run your app (if not already running)
2. Navigate to the "Create Offer" modal
3. Look at the item browsing section

### Step 2: What Should You See?

**✅ If images are loading:**
- Small item preview images in the grid
- Images load smoothly as you scroll
- No broken image icons

**❌ If images are NOT loading:**
- Gray boxes with package icons (📦)
- This is the fallback - **this is okay!**

---

## Detailed Diagnostics

### Method 1: Browser Console (Recommended)

1. **Open DevTools:**
   - Chrome/Edge: `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

2. **Go to Console tab**

3. **You should see:**
   ```
   🔧 Image testing utilities loaded in console!
   Try: testImageLoading(10)
   ```

4. **Run the test:**
   Type in console and press Enter:
   ```javascript
   testImageLoading(10)
   ```

5. **Interpret results:**
   ```
   ✅ Karambit | Fade: 200
   ✅ Karambit | Doppler: 200
   ✅ Butterfly Knife | Fade: 200
   ...
   📊 Results:
   ✅ Successful: 10/10
   📈 Success Rate: 100.0%
   ```

   **100% = Perfect!** Images are loading fine.
   
   **0% = Blocked!** Steam CDN is blocking your requests.
   
   **Mixed results?** Some images work, some don't.

---

### Method 2: Network Tab

1. **Open DevTools → Network tab**

2. **Filter by "Img" (images only)**

3. **Create an offer and browse items**

4. **Watch the network requests:**

**Good (Status 200):**
```
Name: -9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I...
Status: 200
Type: image/png
Size: 2.3 KB
```

**Blocked (Status 403):**
```
Name: -9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I...
Status: 403 Forbidden
Type: text/html
```

**Failed:**
```
Name: -9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I...
Status: (failed)
Type: -
```

---

### Method 3: Test a Single Image

1. **Copy a test URL:**
   ```
   https://community.akamai.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf2PLacDBA5ciJh5C0mf7zO6_ummpD78A_3b2VpI2ljQTsqEZpNW_3IYSSdFc3aAzX-lW9yOu71pC06JrPnCRn6XN2sGGdwUI0NUSB0A/62fx62f
   ```

2. **Paste into browser address bar**

3. **Press Enter**

**✅ Success:** You see a Karambit | Fade image

**❌ Blocked:** Error page or blank page

4. **Or use console:**
   ```javascript
   testSingleImage('paste-url-here')
   ```

---

## Common Issues & Solutions

### Issue 1: All Images Show Fallback Icons

**Cause:** Steam CDN is blocking your IP/location

**Solutions:**

#### Option A: Use Image Proxy (Recommended)

Already built! Just need to enable it:

1. **Update CS2ItemImage component:**

```typescript
// In /components/CS2ItemImage.tsx
const proxiedSrc = useMemo(() => {
  if (src.startsWith('https://community.akamai.steamstatic.com')) {
    // Use proxy
    return `${import.meta.env.VITE_API_URL || 'YOUR_SUPABASE_URL'}/functions/v1/make-server-e2cf3727/proxy-image?url=${encodeURIComponent(src)}`;
  }
  return src;
}, [src]);

// Then use proxiedSrc instead of src in the img tag
```

2. **Add proxy route to server:**

```typescript
// In /supabase/functions/server/index.tsx
app.get('/make-server-e2cf3727/proxy-image', async (c) => {
  const imageUrl = c.req.query('url');
  
  if (!imageUrl || !imageUrl.startsWith('https://community.akamai.steamstatic.com')) {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Image proxy error:', error);
    return new Response('Failed to fetch image', { status: 500 });
  }
});
```

#### Option B: Accept Fallback Icons

**This is totally fine!** Many trading platforms work this way:
- Item **name** is the source of truth
- Images are just visual enhancement
- Fallback icons still look professional

---

### Issue 2: CORS Errors

**Error in console:**
```
Access to image at 'https://community.akamai.steamstatic.com/...' 
has been blocked by CORS policy
```

**Solution:** We already handle this with `crossOrigin="anonymous"` in CS2ItemImage component.

If it persists, use the proxy (Option A above).

---

### Issue 3: Slow Loading

**Cause:** Large number of images loading at once

**Solution:** Already implemented!
- ✅ Lazy loading (`loading="lazy"`)
- ✅ Only load images in viewport
- ✅ Limit to 100 items per view

---

### Issue 4: Some Images Work, Some Don't

**Cause:** Some image hashes are invalid or outdated

**Solution:** Already handled!
- ✅ Each image has error handler
- ✅ Falls back to package icon automatically
- ✅ Logs errors to console for monitoring

---

## Testing Checklist

Use this checklist to verify everything works:

- [ ] Open app in browser
- [ ] Open DevTools Console
- [ ] See "🔧 Image testing utilities loaded"
- [ ] Run `testImageLoading(10)` in console
- [ ] Check success rate
- [ ] If <50%, implement proxy (see Issue 1, Option A)
- [ ] Create a test offer
- [ ] Browse knife category
- [ ] Browse rifle category
- [ ] Search for "Doppler"
- [ ] Verify images load OR fallbacks show
- [ ] Add items to offer
- [ ] Verify added items show images/fallbacks
- [ ] Submit offer
- [ ] View offer in feed
- [ ] Verify feed shows images/fallbacks

---

## Production Checklist

Before deploying:

- [ ] Test image loading from production URL
- [ ] Monitor error rate in production
- [ ] Set up error tracking (optional)
- [ ] Test on different browsers:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Test on different networks:
  - [ ] Home WiFi
  - [ ] Mobile data
  - [ ] Public WiFi
- [ ] Test from different locations (if possible):
  - [ ] Different countries
  - [ ] Different ISPs

---

## Need Help?

### Debug Info to Collect

If images aren't loading, collect this info:

1. **Browser console errors** (copy and paste)
2. **Network tab screenshot** (filtered to Img)
3. **Test results:**
   ```javascript
   getImageStats()
   testImageLoading(10)
   ```
4. **Your location** (country)
5. **Your network** (home/mobile/public)

### Quick Fix

If nothing works and you need to ship fast:

**Use text-only mode:**
```typescript
// In ManualItemEntry.tsx
// Comment out the image component, just show names
{/* <CS2ItemImage src={item.icon} alt={item.name} size="sm" /> */}
```

Item names alone are enough for traders to find matches!

---

## Success Metrics

Your implementation is **production-ready** if:

✅ Fallback system works (always shows something)
✅ Users can browse and add items
✅ Users can create offers
✅ Users can view offers in feed
✅ No console errors (except "Failed to load image" which is handled)

**Don't stress about 100% image load rate!** Even Steam's own marketplace has occasional image loading issues. Your fallback system ensures users can still trade successfully.
