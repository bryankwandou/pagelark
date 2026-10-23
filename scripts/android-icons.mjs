// Renders the Android launcher icons from public/icon.svg: node scripts/android-icons.mjs
// Run after `npx cap add android`. Writes legacy, round and adaptive-foreground PNGs per density.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = 'android/app/src/main/res';
const svg = readFileSync('public/icon.svg', 'utf8');
const bg = '#f7f6f2'; // manifest background_color
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// shape: 'square' (legacy), 'round', or 'foreground' (transparent, logo inside the 66dp safe zone of 108dp)
const html = (size, shape) => {
  const logo = shape === 'foreground' ? size * 0.5 : size * 0.68;
  const radius = shape === 'round' ? '50%' : shape === 'square' ? '18%' : '0';
  const fill = shape === 'foreground' ? 'transparent' : bg;
  return `<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;border-radius:${radius};background:${fill};display:flex;align-items:center;justify-content:center;overflow:hidden">
      <div style="width:${logo}px;height:${logo}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>`;
};

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const page = await browser.newPage();
for (const [name, scale] of Object.entries(densities)) {
  const dir = `${res}/mipmap-${name}`;
  mkdirSync(dir, { recursive: true });
  for (const [file, shape, dp] of [['ic_launcher.png', 'square', 48], ['ic_launcher_round.png', 'round', 48], ['ic_launcher_foreground.png', 'foreground', 108]]) {
    const size = Math.round(dp * scale);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size, shape));
    writeFileSync(`${dir}/${file}`, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
    console.log(`${dir}/${file} ${size}px`);
  }
}
await browser.close();

// Adaptive icon background colour (the foreground PNG sits on top of it).
writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg.toUpperCase()}</color>\n</resources>\n`);
