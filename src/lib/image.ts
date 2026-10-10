// Image pipeline: find the page, flatten it, clean it up.
// Everything runs on canvas in the browser; no pixel leaves the device.

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
 * Guess the page corners. Works on a small copy: builds a brightness mask
 * (paper is usually the brightest large region), then takes the extreme
 * points along the two diagonals. Falls back to a 4% inset when unsure.
 */
export function detectQuad(img: HTMLImageElement | HTMLCanvasElement): Quad {
  const W = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const H = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const s = 240 / Math.max(W, H);
  const w = Math.max(1, Math.round(W * s));
  const h = Math.max(1, Math.round(H * s));
  const d = toCanvas(img, w, h).getContext('2d')!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    sum += lum[i];
  }
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
  const inset: Quad = [
    { x: W * 0.04, y: H * 0.04 },
    { x: W * 0.96, y: H * 0.04 },
    { x: W * 0.96, y: H * 0.96 },
    { x: W * 0.04, y: H * 0.96 },
  ];
  // Too little or too much bright area means the guess is not trustworthy.
  const frac = count / (w * h);
  if (frac < 0.12 || frac > 0.97) return inset;
  const q = [tl.p, tr.p, br.p, bl.p].map((p) => ({ x: p.x / s, y: p.y / s })) as Quad;
  if (quadArea(q) < W * H * 0.12) return inset;
  return q;
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

/** Flatten the quad into an upright rectangle (max 2400px on the long side). */
export function warp(img: HTMLImageElement | HTMLCanvasElement, q: Quad): HTMLCanvasElement {
  let w = Math.round(Math.max(dist(q[0], q[1]), dist(q[3], q[2])));
  let h = Math.round(Math.max(dist(q[0], q[3]), dist(q[1], q[2])));
  const k = Math.min(1, 2400 / Math.max(w, h));
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
