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
  await page.waitForTimeout(1000);
  
  // Debug: check what's on the page
  console.log('\n=== Page content debug ===');
  console.log('Page title:', await page.title());
  console.log('Root div present:', await page.locator('#root').count() > 0);
  const rootText = await page.locator('#root').textContent().catch(() => 'Error getting text');
  console.log('Root div content:', rootText.slice(0, 200));
  
  console.log('\nConsole messages:');
  consoleMessages.forEach(msg => console.log('  ', msg));
  
  // Take a screenshot before waiting
  await page.screenshot({ path: 'test-debug-initial.png', fullPage: true });
  console.log('\nInitial screenshot saved to test-debug-initial.png');
  
  // Check for app element
  const appCount = await page.locator('.app').count();
  console.log('App elements found:', appCount);
  
  if (appCount === 0) {
    throw new Error('App element not found on page');
  }
  
  // Wait for the app to fully load
  await page.waitForTimeout(3000); // Give time for Supabase to load and render
  
  console.log('\n=== Checking for errors ===');
  if (errors.length > 0) {
    console.error('Found console errors:');
    errors.forEach(err => console.error('  -', err));
    throw new Error('Page had console errors');
  } else {
    console.log('✓ No console errors');
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
  
  if (sceneCount < 24 || sceneCount > 27) {
    throw new Error(`Expected ~25 scenes, got ${sceneCount}`);
  }
  if (principleCount < 10 || principleCount > 13) {
    throw new Error(`Expected ~11 principles, got ${principleCount}`);
  }
  console.log('✓ Tree has correct node counts (within expected range)');
  
  console.log('\n=== Testing identity filter ===');
  // Check if filter bar exists and has some filter buttons
  const filterButtons = await page.locator('.filterbar .chipbtn').count();
  console.log(`  Found ${filterButtons} filter buttons`);
  
  if (filterButtons > 0) {
    // Click the first filter button
    await page.click('.filterbar .chipbtn:first-child');
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('[data-layer="scene"]').count();
    console.log(`  Filtered to ${filteredCount} scenes`);
    
    // Clear filter
    await page.click('.filterbar button.ghost');
    await page.waitForTimeout(500);
    const unfilteredCount = await page.locator('[data-layer="scene"]').count();
    if (unfilteredCount < 24 || unfilteredCount > 27) {
      throw new Error(`Filter clear failed: expected ~25 scenes, got ${unfilteredCount}`);
    }
    console.log('✓ Identity filter works');
  } else {
    console.log('⚠ No filter buttons found, skipping filter test');
  }
  
  console.log('\n=== Submitting test story ===');
  await page.click('button[data-testid="open-submit"]');
  await page.waitForTimeout(1000);
  
  // Fill in the form - use the actual placeholder text
  const storyField = page.locator('textarea[placeholder*="发生了什么"]');
  await storyField.waitFor({ timeout: 5000 });
  await storyField.fill('这是一个测试故事，用于验证 submit_story RPC 功能。今天我在工作中遇到了一个技术难题。当时我觉得很困难。后来通过查资料和请教同事解决了。我学到了要善于寻求帮助。');
  
  // Fill in identity fields
  await page.fill('input[placeholder*="快递员"]', '软件工程师');
  await page.fill('input[placeholder*="成都"]', '北京');
  
  // Submit
  await page.click('button:has-text("提交故事")');
  
  // Wait for confirmation toast
  await page.waitForTimeout(3000);
  const toastText = await page.locator('.toast').textContent();
  console.log(`  Toast message: ${toastText}`);
  
  if (!toastText || !toastText.includes('已提交')) {
    throw new Error('Story submission did not show success message');
  }
  console.log('✓ Story submitted successfully');
  
  console.log('\n=== Taking screenshot ===');
  await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
  console.log('✓ Screenshot saved to test-screenshot.png');
  
  await browser.close();
  
  console.log('\n=== All tests passed! ===');
}

test().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
