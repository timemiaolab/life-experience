import { chromium } from 'playwright';

async function testOffline() {
  console.log('Testing offline fallback mode...');
  
  // Build without Supabase env vars
  console.log('\nBuilding without Supabase config...');
  const { execSync } = await import('child_process');
  execSync('VITE_BASE_PATH=/life-experience/ npm run build', { stdio: 'inherit' });
  
  // Set up serve directory
  execSync('rm -rf serve-offline && mkdir -p serve-offline/life-experience && cp -r dist/* serve-offline/life-experience/', { stdio: 'inherit' });
  
  // Start server
  const { spawn } = await import('child_process');
  const server = spawn('python3', ['-m', 'http.server', '4174'], { cwd: 'serve-offline' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Test with browser
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:4174/life-experience/');
  await page.waitForTimeout(3000);
  
  if (errors.length) throw new Error('Offline page errors: ' + errors.join('; '));
  
  const hasSupabaseBadge = await page.locator('.eng-badge.supabase').count() > 0;
  const scenes = await page.locator('[data-layer="scene"]').count();
  
  console.log('DB:SUPABASE badge:', hasSupabaseBadge ? '(present - unexpected!)' : '✓ (not present - correct for offline)');
  console.log('Scenes (from seed):', scenes);
  
  await page.screenshot({ path: 'offline-test.png', fullPage: true });
  
  await browser.close();
  server.kill();
  
  if (hasSupabaseBadge) throw new Error('Offline mode should not show Supabase badge');
  if (scenes < 5) throw new Error('Offline seed data not loaded');
  
  console.log('✓ Offline fallback works');
}

testOffline().catch(err => { console.error('✗', err.message); process.exit(1); });
