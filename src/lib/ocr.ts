import { createWorker, type Worker } from 'tesseract.js';
import type { OcrWord } from './store';

// One worker per language set, created lazily and reused. The language data
// (~10 MB for eng+ind) downloads once and is cached by the browser.
let worker: Worker | null = null;
let workerLangs = '';

export async function recognize(
  dataUrl: string,
  langs: string,
  onProgress?: (p: number) => void,
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
  const { data } = await worker.recognize(dataUrl, {}, { text: true, blocks: true });
  const words: OcrWord[] = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const w of l.words) words.push({ text: w.text, ...w.bbox });
  const img = await new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = dataUrl;
  });
  return { text: data.text.trim(), words, width: img.naturalWidth, height: img.naturalHeight };
}
