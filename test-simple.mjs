import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4173/life-experience/');
  await page.waitForTimeout(4000);
  
  if (errors.length) throw new Error('Page errors: ' + errors.join('; '));
  
  const hasBadge = await page.locator('.eng-badge.supabase').count() > 0;
  const scenes = await page.locator('[data-layer="scene"]').count();
  const principles = await page.locator('[data-layer="principle"]').count();
  
  console.log('DB:SUPABASE badge:', hasBadge ? '✓' : '✗');
  console.log('Scenes:', scenes);
  console.log('Principles:', principles);
  
  await page.screenshot({ path: 'final-test.png', fullPage: true });
  console.log('Screenshot: final-test.png');
  
  await browser.close();
  
  if (!hasBadge || scenes < 20 || principles < 8) {
    throw new Error('Validation failed');
  }
  console.log('✓ All checks passed');
}

test().catch(err => { console.error('✗', err.message); process.exit(1); });
