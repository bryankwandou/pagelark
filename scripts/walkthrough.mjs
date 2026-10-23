// Records a walkthrough video of the real app: node scripts/walkthrough.mjs [baseUrl]
// Landing (scroll, before/after, language), then scan -> crop -> filter -> OCR -> PDF on a phone frame.
// Output: docs/media/walkthrough-desktop.webm and walkthrough-phone.webm (convert with ffmpeg).
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const dir = 'docs/media';
const tmp = 'scripts/out/video';
mkdirSync(dir, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const pause = (p, ms) => p.waitForTimeout(ms);

async function record(name, viewport, run) {
  const ctx = await browser.newContext({ viewport, recordVideo: { dir: `${tmp}/${name}`, size: viewport }, locale: 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  await run(page);
  await ctx.close();
  const [file] = readdirSync(`${tmp}/${name}`);
  renameSync(`${tmp}/${name}/${file}`, `${dir}/walkthrough-${name}.webm`);
  console.log(`saved ${dir}/walkthrough-${name}.webm`);
}

async function smoothScroll(page, to, steps = 40) {
  const from = await page.evaluate(() => scrollY);
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((y) => scrollTo(0, y), from + ((to - from) * i) / steps);
    await pause(page, 30);
  }
}

await record('desktop', { width: 1280, height: 800 }, async (page) => {
  await page.goto(base);
  await page.waitForSelector('.hero h1');
  await pause(page, 1500);
  // Drag the before/after slider across the device mockup.
  const ba = await page.locator('.ba').boundingBox();
  if (ba) {
    await page.mouse.move(ba.x + ba.width * 0.5, ba.y + ba.height / 2);
    for (const f of [0.2, 0.85, 0.5]) {
      await page.mouse.move(ba.x + ba.width * f, ba.y + ba.height / 2, { steps: 25 });
      await pause(page, 300);
    }
  }
  const h = await page.evaluate(() => document.body.scrollHeight - innerHeight);
  await smoothScroll(page, h * 0.35, 60);
  await pause(page, 900);
  await smoothScroll(page, h * 0.7, 60);
  await pause(page, 900);
  const qa = page.locator('.qa button').first();
  if (await qa.count()) { await qa.scrollIntoViewIfNeeded(); await qa.click(); await pause(page, 1000); }
  await smoothScroll(page, 0, 40);
  for (const l of ['id', 'es', 'fr', 'pt', 'en']) {
    await page.selectOption('.nav-right select', l);
    await pause(page, 700);
  }
  await pause(page, 600);
});

await record('phone', { width: 390, height: 844 }, async (page) => {
  await page.goto(base);
  await page.waitForSelector('.hero h1');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 1600;
    const g = c.getContext('2d');
    g.fillStyle = '#4a3b2f'; g.fillRect(0, 0, 1200, 1600);
    g.save(); g.translate(600, 800); g.rotate(-0.05);
    g.fillStyle = '#e6dcc8'; g.fillRect(-460, -640, 920, 1280);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-460, 200, 920, 440);
    g.fillStyle = '#1b1b1b'; g.font = 'bold 64px Arial';
    g.fillText('INVOICE 2048', -380, -480);
    g.font = '44px Arial';
    ['Paper scanned in a browser', 'Total due 125 dollars', 'Thank you for your order'].forEach((l, i) => g.fillText(l, -380, -340 + i * 90));
    g.strokeStyle = '#1d3fbf'; g.lineWidth = 6; g.beginPath(); g.arc(200, 380, 110, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#1d3fbf'; g.font = 'bold 34px Arial'; g.fillText('PAID', 158, 392);
    g.restore();
    return c.toDataURL('image/png').split(',')[1];
  });
  await pause(page, 1200);
  await page.click('.nav-right .btn');
  await page.waitForURL(/#\/app/);
  await pause(page, 1200);
  await page.goto(base + '#/scan');
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  await pause(page, 1000);
  await page.setInputFiles('input[type=file]', { name: 'desk.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('.crop, .btn.primary');
  await pause(page, 1800);
  await page.click('.btn.primary');
  await page.waitForSelector('.thumb-stack:not([disabled])');
  await pause(page, 1000);
  await page.click('.thumb-stack');
  await page.waitForURL(/#\/doc\//);
  await page.waitForSelector('img.fade-in');
  await pause(page, 1200);
  // Cycle through the filters so the printable cleanup is visible.
  const filters = page.locator('.filter');
  for (let i = 1; i < (await filters.count()); i++) { await filters.nth(i).click(); await pause(page, 700); }
  await filters.first().click();
  await pause(page, 900);
  await page.locator('[role=tab]').nth(1).click();
  await pause(page, 600);
  await page.locator('.btn.primary.wide').first().click();
  await page.waitForFunction(() => /invoice|2048/i.test(document.querySelector('.ocr-text')?.value ?? ''), null, { timeout: 120000 }).catch(() => {});
  await pause(page, 1800);
  await page.locator('[role=tab]').nth(3).click();
  await pause(page, 900);
  await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => {}), page.locator('.btn.primary.wide').first().click()]);
  await pause(page, 1500);
  await page.locator('[role=tab]').nth(4).click();
  await pause(page, 1500);
  await page.goto(base + '#/app');
  await pause(page, 1500);
});

await browser.close();
