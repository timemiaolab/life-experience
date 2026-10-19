import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await (await browser.newContext()).newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  console.log('Loading page...');
  await page.goto('http://localhost:4173/life-experience/');
  await page.waitForTimeout(5000);
  
  if (errors.length) {
    console.error('Page errors:', errors);
    throw new Error('Page had errors');
  }
  
  console.log('Page loaded successfully');
  
  // Take initial screenshot
  await page.screenshot({ path: 'pr-zoom-100.png', fullPage: true });
  console.log('Screenshot saved: pr-zoom-100.png');
  
  // Test clicking a node
  console.log('\nClicking first scene node...');
  const firstNode = await page.locator('[data-layer="scene"]').first();
  await firstNode.click();
  await page.waitForTimeout(1000);
  
  const detailPanel = await page.locator('.detail').first();
  const hasOpen = await detailPanel.evaluate(el => el.classList.contains('open'));
  console.log('Detail panel has .open class:', hasOpen);
  
  // Take screenshot with detail panel
  await page.screenshot({ path: 'pr-detail-open.png', fullPage: true });
  console.log('Screenshot saved: pr-detail-open.png');
  
  // Test zoom in
  console.log('\nTesting zoom controls...');
  await page.click('.zoom-controls button:has-text("+")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'pr-zoom-150.png', fullPage: true });
  console.log('Screenshot saved: pr-zoom-150.png');
  
  // Zoom out
  await page.click('.zoom-controls button:has-text("1:1")');
  await page.waitForTimeout(500);
  await page.click('.zoom-controls button:has-text("−")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'pr-zoom-60.png', fullPage: true });
  console.log('Screenshot saved: pr-zoom-60.png');
  
  await browser.close();
  console.log('\n✓ Test complete!');
}

test().catch(err => { console.error('✗', err); process.exit(1); });
