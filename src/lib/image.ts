// Image pipeline: find the page, flatten it, clean it up.
// Everything runs on canvas in the browser; no pixel leaves the device.
import { profiles, type Effort } from './effort';

export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt]; // tl, tr, br, bl
export type Filter = 'printable' | 'original' | 'gray' | 'bw' | 'color';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function toCanvas(img: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * Guess the page corners on a small copy. Two methods:
 * - brightness: paper is usually the brightest large region, so take the
 *   extreme points of a brightness mask along the two diagonals;
 * - edges (effort 3+): Sobel gradients, a Hough transform for straight lines,
 *   then every 2+2 line combination is scored by how much of its outline
 *   actually lies on an edge. This still works on a white desk.
 * The best-supported candidate wins; a 4% inset is used when nothing is sure.
 */
export function detectQuad(img: HTMLImageElement | HTMLCanvasElement, effort: Effort = 3): Quad {
  const { detect, edges } = profiles[effort];
  const W = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const H = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const s = detect / Math.max(W, H);
  const w = Math.max(1, Math.round(W * s));
  const h = Math.max(1, Math.round(H * s));
  const d = toCanvas(img, w, h).getContext('2d')!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const inset: Quad = [
    { x: W * 0.04, y: H * 0.04 },
    { x: W * 0.96, y: H * 0.04 },
    { x: W * 0.96, y: H * 0.96 },
    { x: W * 0.04, y: H * 0.96 },
  ];

  let best = brightQuad(lum, w, h);
  if (edges && w > 16 && h > 16) {
    const soft = boxBlur(lum, w, h, 1);
    const g = sobel(soft, w, h);
    const thr = edgeThreshold(g.mag);
    let top = best ? outlineScore(best, g.mag, soft, w, h, thr) : -1;
    for (const c of lineQuads(g, w, h, thr)) {
      const sc = outlineScore(c, g.mag, soft, w, h, thr);
      // an edge quad must be well supported before it beats brightness
      if (sc > top && sc > 0.55) {
        top = sc;
        best = c;
      }
    }
  }
  if (!best) return inset;
  return best.map((p) => ({ x: Math.min(W, Math.max(0, p.x / s)), y: Math.min(H, Math.max(0, p.y / s)) })) as Quad;
}

function brightQuad(lum: Float32Array, w: number, h: number): Quad | null {
  let sum = 0;
  for (let i = 0; i < w * h; i++) sum += lum[i];
  const mean = sum / (w * h);
  const thr = Math.min(235, mean + 12);
  let tl = { v: Infinity, p: { x: 0, y: 0 } },
    br = { v: -Infinity, p: { x: w, y: h } },
    tr = { v: -Infinity, p: { x: w, y: 0 } },
    bl = { v: -Infinity, p: { x: 0, y: h } };
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      // require neighbours to agree, which drops speckle highlights
      if (lum[i] < thr || lum[i - 1] < thr || lum[i + 1] < thr || lum[i - w] < thr || lum[i + w] < thr) continue;
      count++;
      if (x + y < tl.v) tl = { v: x + y, p: { x, y } };
      if (x + y > br.v) br = { v: x + y, p: { x, y } };
      if (x - y > tr.v) tr = { v: x - y, p: { x, y } };
      if (y - x > bl.v) bl = { v: y - x, p: { x, y } };
    }
  }
  // Too little or too much bright area means the guess is not trustworthy.
  const frac = count / (w * h);
  if (frac < 0.12 || frac > 0.97) return null;
  const q: Quad = [tl.p, tr.p, br.p, bl.p];
  return quadArea(q) < w * h * 0.12 ? null : q;
}

type Grad = { mag: Float32Array; ang: Uint8Array };

// Sobel magnitude, plus the gradient direction folded into 0..179 degrees,
// which is also the normal angle of the line the pixel sits on.
function sobel(g: Float32Array, w: number, h: number): Grad {
  const mag = new Float32Array(w * h);
  const ang = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      mag[i] = Math.hypot(gx, gy);
      let a = Math.round((Math.atan2(gy, gx) * 180) / Math.PI);
      if (a < 0) a += 180;
      ang[i] = a % 180;
    }
  }
  return { mag, ang };
}

// Strong edges only: the 85th percentile of a sample, never below a floor.
function edgeThreshold(mag: Float32Array) {
  const step = Math.max(1, Math.floor(mag.length / 4000));
  const sample: number[] = [];
  for (let i = 0; i < mag.length; i += step) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  return Math.max(60, sample[Math.floor(sample.length * 0.85)]);
}

type Line = { t: number; r: number; v: number };

/** Hough lines (x cos t + y sin t = r), each edge pixel voting near its own normal. */
function houghLines({ mag, ang }: Grad, w: number, h: number, thr: number): Line[] {
  const diag = Math.ceil(Math.hypot(w, h));
  const NR = 2 * diag + 1;
  const acc = new Uint32Array(180 * NR);
  const cos = new Float32Array(180), sin = new Float32Array(180);
  for (let t = 0; t < 180; t++) {
    cos[t] = Math.cos((t * Math.PI) / 180);
    sin[t] = Math.sin((t * Math.PI) / 180);
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mag[i] < thr) continue;
      for (let k = -6; k <= 6; k++) {
        const t = (ang[i] + k + 180) % 180;
        acc[t * NR + Math.round(x * cos[t] + y * sin[t]) + diag]++;
      }
    }
  }
  const minVotes = Math.max(8, Math.min(w, h) * 0.2);
  const peaks: Line[] = [];
  for (let t = 0; t < 180; t++) {
    for (let r = 1; r < NR - 1; r++) {
      const v = acc[t * NR + r];
      if (v < minVotes || v < acc[t * NR + r - 1] || v < acc[t * NR + r + 1]) continue;
      peaks.push({ t, r: r - diag, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  // Keep distinct lines only. t and t±180 with -r are the same line.
  const near = Math.max(w, h) * 0.05;
  const out: Line[] = [];
  for (const p of peaks) {
    const dup = out.some((q) => {
      const dt = Math.abs(p.t - q.t);
      if (dt < 8) return Math.abs(p.r - q.r) < near;
      if (dt > 172) return Math.abs(p.r + q.r) < near;
      return false;
    });
    if (!dup) out.push(p);
    if (out.length >= 24) break;
  }
  return out;
}

function meet(a: Line, b: Line): Pt | null {
  const ta = (a.t * Math.PI) / 180, tb = (b.t * Math.PI) / 180;
  const c1 = Math.cos(ta), s1 = Math.sin(ta), c2 = Math.cos(tb), s2 = Math.sin(tb);
  const det = c1 * s2 - s1 * c2;
  if (Math.abs(det) < 1e-6) return null;
  return { x: (a.r * s2 - s1 * b.r) / det, y: (c1 * b.r - a.r * c2) / det };
}

/** All plausible quads made of two roughly horizontal and two roughly vertical lines. */
function lineQuads(g: Grad, w: number, h: number, thr: number): Quad[] {
  const lines = houghLines(g, w, h, thr);
  // normals near 90 degrees belong to horizontal lines
  const hor = lines.filter((l) => l.t >= 45 && l.t < 135).slice(0, 8);
  const ver = lines.filter((l) => l.t < 45 || l.t >= 135).slice(0, 8);
  const yAt = (l: Line) => (l.r - (w / 2) * Math.cos((l.t * Math.PI) / 180)) / Math.sin((l.t * Math.PI) / 180);
  const xAt = (l: Line) => (l.r - (h / 2) * Math.sin((l.t * Math.PI) / 180)) / Math.cos((l.t * Math.PI) / 180);
  const quads: Quad[] = [];
  for (let i = 0; i < hor.length; i++)
    for (let j = i + 1; j < hor.length; j++) {
      const [top, bot] = yAt(hor[i]) < yAt(hor[j]) ? [hor[i], hor[j]] : [hor[j], hor[i]];
      if (yAt(bot) - yAt(top) < h * 0.25) continue;
      for (let k = 0; k < ver.length; k++)
        for (let m = k + 1; m < ver.length; m++) {
          const [lef, rig] = xAt(ver[k]) < xAt(ver[m]) ? [ver[k], ver[m]] : [ver[m], ver[k]];
          if (xAt(rig) - xAt(lef) < w * 0.25) continue;
          const pts = [meet(top, lef), meet(top, rig), meet(bot, rig), meet(bot, lef)];
          if (pts.some((p) => !p || p.x < -w * 0.02 || p.y < -h * 0.02 || p.x > w * 1.02 || p.y > h * 1.02)) continue;
          const q = pts as Quad;
          if (!convex(q) || quadArea(q) < w * h * 0.12) continue;
          quads.push(q);
        }
    }
  return quads;
}

function convex(q: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (z === 0) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

/**
 * Share of the outline that sits on a strong edge with the paper side
 * brighter than the outside. That second test rejects the box around a block
 * of text, whose outside is paper. Weighted toward the weakest side so three
 * good sides cannot carry a missing fourth, with a small bonus for area so
 * the outer sheet beats an inner margin.
 */
function outlineScore(q: Quad, mag: Float32Array, lum: Float32Array, w: number, h: number, thr: number) {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const lumAt = (x: number, y: number) =>
    lum[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const sides: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const len = Math.max(1e-6, dist(a, b));
    // unit normal pointing into the quad
    let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    if (nx * (cx - (a.x + b.x) / 2) + ny * (cy - (a.y + b.y) / 2) < 0) { nx = -nx; ny = -ny; }
    const n = Math.max(20, Math.min(200, Math.round(len)));
    let hit = 0;
    for (let k = 0; k <= n; k++) {
      const fx = a.x + ((b.x - a.x) * k) / n, fy = a.y + ((b.y - a.y) * k) / n;
      if (lumAt(fx + nx * 3, fy + ny * 3) - lumAt(fx - nx * 3, fy - ny * 3) < 3) continue;
      const x = Math.round(fx), y = Math.round(fy);
      let on = false;
      for (let dy = -1; dy <= 1 && !on; dy++)
        for (let dx = -1; dx <= 1 && !on; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && mag[yy * w + xx] >= thr) on = true;
        }
      if (on) hit++;
    }
    sides.push(hit / (n + 1));
  }
  const mean = sides.reduce((s, v) => s + v, 0) / 4;
  return 0.6 * mean + 0.4 * Math.min(...sides) + 0.15 * (quadArea(q) / (w * h));
}

export function quadArea(q: Quad) {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i], n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// Solve the 8-parameter homography mapping unit rectangle -> quad.
function homography(q: Quad, w: number, h: number) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination
  for (let c = 0; c < 8; c++) {
    let m = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r;
    [A[c], A[m]] = [A[m], A[c]];
    [b[c], b[m]] = [b[m], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

/** Flatten the quad into an upright rectangle (at most maxSide px on the long side). */
export function warp(img: HTMLImageElement | HTMLCanvasElement, q: Quad, maxSide = 2400): HTMLCanvasElement {
  let w = Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2])));
  let h = Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])));
  const k = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * k));
  h = Math.max(1, Math.round(h * k));
  const SW = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const SH = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const sd = toCanvas(img, SW, SH).getContext('2d')!.getImageData(0, 0, SW, SH).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(w, h);
  const [a, b, c, d, e, f, g, hh] = homography(q, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const den = g * x + hh * y + 1;
      const u = (a * x + b * y + c) / den;
      const v = (d * x + e * y + f) / den;
      const x0 = Math.floor(u), y0 = Math.floor(v);
      const o = (y * w + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= SW - 1 || y0 >= SH - 1) {
        od.data[o] = od.data[o + 1] = od.data[o + 2] = 255;
        od.data[o + 3] = 255;
        continue;
      }
      const fx = u - x0, fy = v - y0;
      const i00 = (y0 * SW + x0) * 4, i10 = i00 + 4, i01 = i00 + SW * 4, i11 = i01 + 4;
      for (let ch = 0; ch < 3; ch++) {
        od.data[o + ch] =
          sd[i00 + ch] * (1 - fx) * (1 - fy) + sd[i10 + ch] * fx * (1 - fy) +
          sd[i01 + ch] * (1 - fx) * fy + sd[i11 + ch] * fx * fy;
      }
      od.data[o + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

// Box blur via summed-area table; radius r on a single channel.
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
      out[y * w + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/**
 * The "printable" look: estimate the paper's own shading (shadows, yellow
 * tint, uneven light) with a large blur of the brightest channel, divide it
 * out so the sheet goes flat white, then stretch contrast. Ink colour such as
 * a blue stamp or a signature survives because each channel is divided by
 * the same background estimate.
 */
export function applyFilter(src: HTMLCanvasElement, filter: Filter, strength = 1): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  if (filter === 'original') return out;
  const id = ctx.getImageData(0, 0, w, h);
  const p = id.data;
  const n = w * h;

  if (filter === 'color') {
    for (let i = 0; i < n * 4; i += 4) {
      for (let c = 0; c < 3; c++) p[i + c] = clamp((p[i + c] - 128) * 1.25 + 138);
    }
    ctx.putImageData(id, 0, 0);
    return out;
  }

  const maxc = new Float32Array(n);
  for (let i = 0; i < n; i++) maxc[i] = Math.max(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);
  const bg = boxBlur(boxBlur(maxc, w, h, Math.max(8, Math.round(Math.max(w, h) / 40))), w, h, Math.max(8, Math.round(Math.max(w, h) / 40)));

  for (let i = 0; i < n; i++) {
    const b = Math.max(bg[i], 1);
    const o = i * 4;
    let r = (p[o] / b) * 255, g = (p[o + 1] / b) * 255, bl = (p[o + 2] / b) * 255;
    // push near-white to pure white, deepen ink
    const lift = (v: number) => clamp(255 - (255 - v) * (1 + 0.9 * strength));
    r = lift(r); g = lift(g); bl = lift(bl);
    if (filter === 'printable') {
      // keep saturated ink (stamps, logos) but clear faint tint on paper
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx > 225 && mx - mn < 40) r = g = bl = 255;
      p[o] = r; p[o + 1] = g; p[o + 2] = bl;
    } else {
      const y = 0.299 * r + 0.587 * g + 0.114 * bl;
      const v = filter === 'bw' ? (y > 165 ? 255 : 0) : y > 240 ? 255 : y;
      p[o] = p[o + 1] = p[o + 2] = v;
    }
  }
  ctx.putImageData(id, 0, 0);
  return out;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function rotate(src: HTMLCanvasElement, deg: 90 | -90 | 180): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const swap = deg !== 180;
  c.width = swap ? src.height : src.width;
  c.height = swap ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.88) => c.toDataURL('image/jpeg', q);
