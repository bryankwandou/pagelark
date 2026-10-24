import { createWorker, type Worker } from 'tesseract.js';
import type { OcrWord } from './store';
import { profiles, type Effort } from './effort';

// One worker per language set, created lazily and reused. The language data
// (~10 MB for eng+ind) downloads once and is cached by the browser.
let worker: Worker | null = null;
let workerLangs = '';

// Higher effort hands Tesseract a larger, contrast-stretched gray copy.
// Small print gains the most from the upscale.
function prepare(img: HTMLImageElement, scale: number, gray: boolean) {
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (gray) {
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const p = id.data;
    let lo = 255, hi = 0;
    for (let i = 0; i < p.length; i += 4) {
      const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      p[i] = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = (p[i] - lo) * k;
    ctx.putImageData(id, 0, 0);
  }
  return c;
}

export async function recognize(
  dataUrl: string,
  langs: string,
  onProgress?: (p: number) => void,
  effort: Effort = 3,
): Promise<{ text: string; words: OcrWord[]; width: number; height: number }> {
  if (!worker || workerLangs !== langs) {
    await worker?.terminate();
    worker = await createWorker(langs, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
      },
    });
    workerLangs = langs;
  }
  const img = await new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = dataUrl;
  });
  const { ocrScale, ocrGray } = profiles[effort];
  const input = ocrScale > 1 || ocrGray ? prepare(img, ocrScale, ocrGray) : dataUrl;
  const { data } = await worker.recognize(input, {}, { text: true, blocks: true });
  // Word boxes go back to page pixels so the PDF text layer still lines up.
  const words: OcrWord[] = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const w of l.words)
          words.push({
            text: w.text,
            x0: w.bbox.x0 / ocrScale,
            y0: w.bbox.y0 / ocrScale,
            x1: w.bbox.x1 / ocrScale,
            y1: w.bbox.y1 / ocrScale,
          });
  return { text: data.text.trim(), words, width: img.naturalWidth, height: img.naturalHeight };
}
