import { jsPDF } from 'jspdf';
import type { Doc } from './store';
import { loadImage } from './image';

export type PageSize = 'a4' | 'letter' | 'fit';

/**
 * Build a PDF. Pages that went through OCR get an invisible text layer laid
 * over the image at each word's position, so the file is searchable and the
 * text can be selected and copied in any PDF reader.
 */
export async function buildPdf(doc: Doc, size: PageSize = 'a4'): Promise<Blob> {
  let pdf: jsPDF | null = null;
  for (const page of doc.pages) {
    const img = await loadImage(page.out);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const landscape = iw > ih;
    let pw: number, ph: number;
    if (size === 'fit') {
      pw = (iw / 150) * 72; // treat the scan as 150 dpi
      ph = (ih / 150) * 72;
    } else {
      const [a, b] = size === 'a4' ? [595.28, 841.89] : [612, 792];
      [pw, ph] = landscape ? [b, a] : [a, b];
    }
    const opts = { unit: 'pt' as const, format: [pw, ph], orientation: (pw > ph ? 'l' : 'p') as 'l' | 'p' };
    if (!pdf) pdf = new jsPDF(opts);
    else pdf.addPage(opts.format, opts.orientation);

    // contain the image inside the page
    const k = Math.min(pw / iw, ph / ih);
    const dw = iw * k, dh = ih * k, dx = (pw - dw) / 2, dy = (ph - dh) / 2;
    pdf.addImage(page.out, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');

    if (page.words?.length) {
      for (const w of page.words) {
        if (!w.text.trim()) continue;
        const hpt = (w.y1 - w.y0) * k;
        pdf.setFontSize(Math.max(2, hpt * 0.9));
        const wpt = pdf.getTextWidth(w.text) || 1;
        pdf.text(w.text, dx + w.x0 * k, dy + w.y1 * k - hpt * 0.15, {
          renderingMode: 'invisible',
          horizontalScale: ((w.x1 - w.x0) * k) / wpt,
        } as never);
      }
    }
  }
  if (!pdf) pdf = new jsPDF();
  pdf.setProperties({ title: doc.name, creator: 'Pagelark' });
  return pdf.output('blob');
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'downloaded';
}

export async function sha256(blob: Blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
