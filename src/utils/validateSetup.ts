/**
 * Setup Validation Utility
 * Run this to verify everything is working correctly
 */

import { CS2_ITEMS_DATABASE } from './cs2ItemDatabase';

export function validateSetup() {
  const results = {
    database: false,
    images: false,
    categories: false,
    errors: [] as string[],
  };

  console.log('🔍 Validating CS Trading Hub Setup...\n');

  // 1. Check database
  console.log('1️⃣ Checking CS2 item database...');
  if (CS2_ITEMS_DATABASE.length > 0) {
    console.log(`✅ Database loaded: ${CS2_ITEMS_DATABASE.length} items`);
    results.database = true;
  } else {
    console.error('❌ Database is empty');
    results.errors.push('Database is empty');
  }

  // 2. Check image URLs
  console.log('\n2️⃣ Checking image URLs...');
  const sampleSize = Math.min(5, CS2_ITEMS_DATABASE.length);
  const hasValidImages = CS2_ITEMS_DATABASE.slice(0, sampleSize).every(item => {
    return item.icon && item.icon.startsWith('https://');
  });
  
  if (hasValidImages) {
    console.log(`✅ Sample images have valid URLs`);
    results.images = true;
  } else {
    console.error('❌ Some images have invalid URLs');
    results.errors.push('Invalid image URLs detected');
  }

  // 3. Check categories
  console.log('\n3️⃣ Checking categories...');
  const categories = {
    knife: 0,
    rifle: 0,
    pistol: 0,
    smg: 0,
    heavy: 0,
  };

  CS2_ITEMS_DATABASE.forEach(item => {
    if (categories[item.category] !== undefined) {
      categories[item.category]++;
    }
  });

  const allCategoriesPopulated = Object.values(categories).every(count => count > 0);
  
  if (allCategoriesPopulated) {
    console.log('✅ All categories populated:');
    console.log(`   🔪 Knives: ${categories.knife}`);
    console.log(`   🎯 Rifles: ${categories.rifle}`);
    console.log(`   🔫 Pistols: ${categories.pistol}`);
    console.log(`   💨 SMGs: ${categories.smg}`);
    console.log(`   💥 Heavy: ${categories.heavy}`);
    results.categories = true;
  } else {
    console.error('❌ Some categories are empty');
    results.errors.push('Empty categories detected');
  }

  // 4. Summary
  console.log('\n📊 Validation Summary:');
  const allPassed = results.database && results.images && results.categories;
  
  if (allPassed) {
    console.log('✅ All checks passed! Setup is complete.');
    console.log('\n🚀 Ready to use!');
    console.log('Try running: testImageLoading(10)');
  } else {
    console.error('❌ Some checks failed:');
    results.errors.forEach(error => console.error(`   • ${error}`));
  }

  return results;
}

// Auto-run on import in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    validateSetup();
  }, 1000);
}
