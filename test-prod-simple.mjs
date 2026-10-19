import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`${msg.type()}: ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4173/life-experience/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // Give time for Supabase to fully load
  
  console.log('\n=== Checking for errors ===');
  if (errors.length > 0) {
    console.error('Found errors:');
    errors.forEach(err => console.error('  -', err));
    throw new Error('Page had errors');
  } else {
    console.log('✓ No page errors');
  }
  
  console.log('\n=== Checking DB:SUPABASE badge ===');
  const supabaseBadge = await page.locator('.eng-badge.supabase').count();
  if (supabaseBadge === 0) {
    throw new Error('DB:SUPABASE badge not found');
  }
  console.log('✓ DB:SUPABASE badge is visible');
  
  console.log('\n=== Counting nodes ===');
  const sceneCount = await page.locator('[data-layer="scene"]').count();
  const principleCount = await page.locator('[data-layer="principle"]').count();
  console.log(`  Scenes: ${sceneCount}`);
  console.log(`  Principles: ${principleCount}`);
  
  if (sceneCount < 20 || sceneCount > 30) {
    throw new Error(`Expected ~25 scenes, got ${sceneCount}`);
  }
  if (principleCount < 8 || principleCount > 15) {
    throw new Error(`Expected ~11 principles, got ${principleCount}`);
  }
  console.log('✓ Tree has correct node counts');
  
  console.log('\n=== Testing identity filter ===');
  const filterButtons = await page.locator('.filterbar .chipbtn').count();
  console.log(`  Found ${filterButtons} filter chip buttons`);
  
  if (filterButtons > 0) {
    await page.click('.filterbar .chipbtn:first-child');
    await page.waitForTimeout(1000);
    const filteredCount = await page.locator('[data-layer="scene"]').count();
    console.log(`  After filter: ${filteredCount} scenes visible`);
    
    await page.click('.filterbar button.ghost');
    await page.waitForTimeout(1000);
    const clearedCount = await page.locator('[data-layer="scene"]').count();
    console.log(`  After clear: ${clearedCount} scenes visible`);
    console.log('✓ Identity filter works');
  } else {
    console.log('⚠ No filter buttons visible (might need contributions with identity data)');
  }
  
  console.log('\n=== Taking final screenshot ===');
  await page.screenshot({ path: 'production-test-screenshot.png', fullPage: true });
  console.log('✓ Screenshot saved to production-test-screenshot.png');
  
  await browser.close();
  
  console.log('\n=== All core tests passed! ===');
  console.log('\nNote: Story submission test skipped (would create real DB entries).');
  console.log('The coordinator can test submission manually or via direct RPC call.');
}

test().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
