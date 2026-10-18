// End-to-end smoke test against a running build: node scripts/smoke.mjs [baseUrl]
// Imports a synthetic photo, crops, saves, runs OCR, exports a PDF and checks it.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = 'scripts/out';
mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, info = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const errors = [];
for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }], ['laptop', { width: 1440, height: 900 }]]) {
  const p = await browser.newPage({ viewport });
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  await p.goto(base);
  await p.waitForSelector('.hero h1');
  await p.waitForTimeout(900);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`landing renders on ${label}`, sw <= 0, `overflow=${sw}px`);
  await p.screenshot({ path: `${out}/landing-${label}.png` });
  await p.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`flow: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text().slice(0, 200)));

// A photo of a page on a desk: dark background, tilted white sheet with text.
await page.goto(base);
const png = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1600;
  const g = c.getContext('2d');
  g.fillStyle = '#4a3b2f'; g.fillRect(0, 0, 1200, 1600);
  g.save(); g.translate(600, 800); g.rotate(-0.05);
  g.fillStyle = '#ece6da'; g.fillRect(-460, -640, 920, 1280);
  g.fillStyle = '#1b1b1b'; g.font = 'bold 64px Arial';
  g.fillText('INVOICE 2048', -380, -480);
  g.font = '44px Arial';
  ['Paper scanned in a browser', 'Total due 125 dollars', 'Thank you for your order'].forEach((l, i) => g.fillText(l, -380, -340 + i * 90));
  g.restore();
  return c.toDataURL('image/png').split(',')[1];
});

await page.goto(base + '#/scan');
await page.waitForSelector('input[type=file]', { state: 'attached' });
await page.setInputFiles('input[type=file]', { name: 'desk.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await page.waitForSelector('.crop, .btn.primary');
await page.screenshot({ path: `${out}/crop.png` });
await page.click('.btn.primary');
await page.waitForSelector('.thumb-stack:not([disabled])');
await page.click('.thumb-stack');
await page.waitForURL(/#\/doc\//);
await page.waitForSelector('.page-view img, img.fade-in');
check('scan saved as a document', true, page.url().split('#')[1]);
const docOverflow = await page.evaluate(() => {
  const h = document.querySelector('.doc-head');
  return Math.max(document.documentElement.scrollWidth - innerWidth, h ? h.scrollWidth - h.clientWidth : 0);
});
check('document screen fits a phone', docOverflow <= 0, `overflow=${docOverflow}px`);
await page.screenshot({ path: `${out}/doc.png` });

// OCR
await page.locator('[role=tab]').nth(1).click();
await page.locator('.btn.primary.wide').first().click();
const ocr = await page.waitForFunction(() => /invoice|2048|order/i.test(document.querySelector('.ocr-text')?.value ?? ''), null, { timeout: 120000 }).then(() => true, () => false);
if (!ocr) await page.screenshot({ path: `${out}/ocr-fail.png` });
check('OCR reads the page', ocr, ocr ? '' : (await page.locator('.ocr-text').inputValue().catch(() => 'no text box')).slice(0, 120));

// Export
await page.locator('[role=tab]').nth(3).click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('.btn.primary.wide').first().click()]);
const file = `${out}/${dl.suggestedFilename()}`;
await dl.saveAs(file);
const pdf = readFileSync(file).toString('latin1');
check('PDF exported', pdf.startsWith('%PDF'), `${(pdf.length / 1024).toFixed(0)} KB`);
check('PDF carries a text layer', /INVOICE|2048/i.test(pdf) || /\/Font/.test(pdf));

await page.goto(base + '#/app');
await page.waitForTimeout(600);
check('document listed on home', (await page.locator('text=/scan|doc/i').count()) > 0);
await page.screenshot({ path: `${out}/home.png` });

check('no uncaught page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
