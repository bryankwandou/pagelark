// One-off check: the effort slider on the OCR tab moves and OCR still reads at both ends.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://pagelark-scanner.vercel.app/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
const png = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1600;
  const g = c.getContext('2d');
  g.fillStyle = '#4a3b2f'; g.fillRect(0, 0, 1200, 1600);
  g.fillStyle = '#ece6da'; g.fillRect(140, 160, 920, 1280);
  g.fillStyle = '#1b1b1b'; g.font = 'bold 64px Arial';
  g.fillText('INVOICE 2048', 220, 320);
  g.font = '44px Arial';
  g.fillText('Thank you for your order', 220, 460);
  return c.toDataURL('image/png').split(',')[1];
});
await page.goto(base + '#/scan');
await page.setInputFiles('input[type=file]', { name: 'desk.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await page.waitForSelector('.crop, .btn.primary');
await page.click('.btn.primary');
await page.waitForSelector('.thumb-stack:not([disabled])');
await page.click('.thumb-stack');
await page.waitForURL(/#\/doc\//);
await page.locator('[role=tab]').nth(1).click();

const slider = page.locator('.effort').first();
const range = slider.locator('input[type=range]');
for (const level of [1, 6]) {
  await slider.scrollIntoViewIfNeeded();
  await slider.hover();
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, level === 6 ? 100 : -100); await page.waitForTimeout(60); }
  const v = Number(await range.inputValue());
  const label = await slider.locator('.effort-head strong').textContent();
  const t0 = Date.now();
  await page.locator('.btn.primary.wide').first().click();
  const ran = await page.waitForSelector('.busy', { timeout: 5000 }).then(() => true, () => false);
  await page.waitForSelector('.busy', { state: 'detached', timeout: 180000 });
  const ok = ran && /invoice|2048|order/i.test(await page.locator('.ocr-text').inputValue());
  console.log(`${ok && v === level ? 'PASS' : 'FAIL'}  OCR tab at level ${v} (${label}) read the page in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await page.screenshot({ path: `scripts/out/ocr-effort-${level}.png` });
}
console.log(errors.length ? `FAIL  page errors: ${errors.join(' | ')}` : 'PASS  no page errors');
await browser.close();
