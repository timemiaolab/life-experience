import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  
  await page.goto('http://localhost:4173/life-experience/');
  await page.waitForTimeout(5000);
  
  // Click a node
  const firstNode = await page.locator('[data-layer="scene"]').first();
  await firstNode.click();
  await page.waitForTimeout(1000);
  
  // Check if detail panel content is visible
  const dpVisible = await page.locator('.dp').isVisible();
  console.log('DP element visible:', dpVisible);
  
  const detailClass = await page.locator('.detail').first().getAttribute('class');
  console.log('Detail element class:', detailClass);
  
  const hintText = await page.locator('.hint').textContent();
  console.log('Hint text:', hintText);
  
  await browser.close();
}

test().catch(err => { console.error('✗', err); process.exit(1); });
