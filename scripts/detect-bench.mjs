// Corner-finding benchmark across the six effort levels.
// Draws photos of a page on a desk with known corners, runs the real
// detectQuad from the Vite dev server, and reports the worst corner error
// as a share of the photo diagonal.
//   npx vite --port 4390 &  node scripts/detect-bench.mjs http://localhost:4390/
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4390/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

const rows = await page.evaluate(async () => {
  const { detectQuad } = await import('/src/lib/image.ts');
  const W = 1200, H = 1600;

  function scene({ desk, paper, corners, noise = 0, shadow = 0.25 }) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = desk;
    g.fillRect(0, 0, W, H);
    if (noise) {
      const id = g.getImageData(0, 0, W, H);
      let s = 7;
      for (let i = 0; i < id.data.length; i += 4) {
        s = (s * 16807) % 2147483647;
        const n = ((s / 2147483647) - 0.5) * noise;
        id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n;
      }
      g.putImageData(id, 0, 0);
    }
    const path = () => {
      g.beginPath();
      corners.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
    };
    g.save();
    g.shadowColor = `rgba(0,0,0,${shadow})`;
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    g.fillStyle = paper;
    path();
    g.fill();
    g.restore();
    // text rows, mapped onto the page by bilinear interpolation
    const at = (u, v) => {
      const [a, b, cc, d] = corners;
      const top = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      const bot = { x: d.x + (cc.x - d.x) * u, y: d.y + (cc.y - d.y) * u };
      return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
    };
    g.strokeStyle = '#2a2f45';
    g.lineWidth = 5;
    for (let r = 0; r < 26; r++) {
      const v = 0.1 + r * 0.03;
      const len = 0.55 + ((r * 37) % 30) / 100;
      const p0 = at(0.1, v), p1 = at(0.1 + len * 0.8, v);
      g.beginPath();
      g.moveTo(p0.x, p0.y);
      g.lineTo(p1.x, p1.y);
      g.stroke();
    }
    return { c, corners };
  }

  const rot = (cx, cy, w, h, deg) => {
    const a = (deg * Math.PI) / 180;
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => ({
      x: cx + x * Math.cos(a) - y * Math.sin(a),
      y: cy + x * Math.sin(a) + y * Math.cos(a),
    }));
  };

  const scenes = {
    'dark desk, tilted 8deg': scene({ desk: '#5b4631', paper: '#f4efe3', corners: rot(600, 800, 820, 1100, 8) }),
    'white page on white desk': scene({ desk: '#e6e5e0', paper: '#fbfbf7', corners: rot(610, 790, 860, 1150, -6), shadow: 0.35 }),
    'perspective, page fills 80%': scene({
      desk: '#3d4250',
      paper: '#f6f4ee',
      corners: [{ x: 230, y: 170 }, { x: 990, y: 140 }, { x: 1120, y: 1500 }, { x: 90, y: 1460 }],
    }),
    'noisy gray desk': scene({ desk: '#9a9a96', paper: '#f2f1ec', corners: rot(590, 820, 760, 1040, 14), noise: 70 }),
  };

  const diag = Math.hypot(W, H);
  const out = [];
  for (const [name, { c, corners }] of Object.entries(scenes)) {
    for (let e = 1; e <= 6; e++) {
      const t0 = performance.now();
      const q = detectQuad(c, e);
      const ms = performance.now() - t0;
      const err = Math.max(...q.map((p, i) => Math.hypot(p.x - corners[i].x, p.y - corners[i].y))) / diag;
      out.push({ name, e, err, ms });
    }
  }
  return out;
});

let last = '';
for (const r of rows) {
  if (r.name !== last) console.log(`\n${r.name}`);
  last = r.name;
  const verdict = r.err < 0.02 ? 'good' : r.err < 0.05 ? 'ok' : 'off';
  console.log(`  effort ${r.e}  worst corner ${(r.err * 100).toFixed(1).padStart(5)}% of diagonal  ${verdict.padEnd(4)}  ${r.ms.toFixed(0).padStart(4)} ms`);
}
await browser.close();
