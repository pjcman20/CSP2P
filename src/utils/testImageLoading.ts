/**
 * Test utility for CS2 item image loading
 * Run this in browser console to diagnose image issues
 */

import { CS2_ITEMS_DATABASE } from './cs2ItemDatabase';

export async function testImageLoading(limit = 10) {
  console.log('🧪 Testing CS2 Item Image Loading...\n');
  
  const testItems = CS2_ITEMS_DATABASE.slice(0, limit);
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ item: string; url: string; error: string }>,
  };

  for (const item of testItems) {
    try {
      const response = await fetch(item.icon, { method: 'HEAD' });
      
      if (response.ok) {
        console.log(`✅ ${item.name}: ${response.status}`);
        results.success++;
      } else {
        console.error(`❌ ${item.name}: ${response.status} ${response.statusText}`);
        results.failed++;
        results.errors.push({
          item: item.name,
          url: item.icon,
          error: `${response.status} ${response.statusText}`,
        });
      }
    } catch (error: any) {
      console.error(`❌ ${item.name}: ${error.message}`);
      results.failed++;
      results.errors.push({
        item: item.name,
        url: item.icon,
        error: error.message,
      });
    }
  }

  console.log('\n📊 Results:');
  console.log(`✅ Successful: ${results.success}/${limit}`);
  console.log(`❌ Failed: ${results.failed}/${limit}`);
  console.log(`📈 Success Rate: ${((results.success / limit) * 100).toFixed(1)}%\n`);

  if (results.errors.length > 0) {
    console.log('❌ Failed Items:');
    results.errors.forEach(({ item, url, error }) => {
      console.log(`  • ${item}`);
      console.log(`    URL: ${url}`);
      console.log(`    Error: ${error}\n`);
    });
  }

  return results;
}

/**
 * Test a single image URL
 */
export async function testSingleImage(url: string) {
  console.log(`🧪 Testing: ${url}\n`);

  try {
    // Test 1: HEAD request
    console.log('Test 1: HEAD request...');
    const headResponse = await fetch(url, { method: 'HEAD' });
    console.log(`  Status: ${headResponse.status} ${headResponse.statusText}`);
    console.log(`  Content-Type: ${headResponse.headers.get('Content-Type')}`);
    console.log(`  Cache-Control: ${headResponse.headers.get('Cache-Control')}\n`);

    // Test 2: GET request
    console.log('Test 2: GET request...');
    const getResponse = await fetch(url);
    const blob = await getResponse.blob();
    console.log(`  Status: ${getResponse.status} ${getResponse.statusText}`);
    console.log(`  Size: ${blob.size} bytes`);
    console.log(`  Type: ${blob.type}\n`);

    // Test 3: Create image element
    console.log('Test 3: Image element...');
    const img = new Image();
    
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = () => resolve('loaded');
      img.onerror = () => reject('failed');
      img.src = url;
    });

    const result = await loadPromise;
    console.log(`  ✅ Image ${result}`);
    console.log(`  Dimensions: ${img.width}x${img.height}px\n`);

    console.log('✅ All tests passed!');
    return true;
  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Get image loading statistics
 */
export function getImageStats() {
  const categories = {
    knife: 0,
    rifle: 0,
    pistol: 0,
    smg: 0,
    heavy: 0,
  };

  CS2_ITEMS_DATABASE.forEach(item => {
    categories[item.category]++;
  });

  return {
    total: CS2_ITEMS_DATABASE.length,
    byCategory: categories,
    sampleUrls: {
      knife: CS2_ITEMS_DATABASE.find(i => i.category === 'knife')?.icon,
      rifle: CS2_ITEMS_DATABASE.find(i => i.category === 'rifle')?.icon,
      pistol: CS2_ITEMS_DATABASE.find(i => i.category === 'pistol')?.icon,
    },
  };
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).testImageLoading = testImageLoading;
  (window as any).testSingleImage = testSingleImage;
  (window as any).getImageStats = getImageStats;
  
  console.log('🔧 Image testing utilities loaded!');
  console.log('Available commands:');
  console.log('  • testImageLoading(10) - Test first 10 images');
  console.log('  • testSingleImage(url) - Test specific image URL');
  console.log('  • getImageStats() - Get database statistics');
}
