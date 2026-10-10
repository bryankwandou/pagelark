import { get, set, del, keys } from 'idb-keyval';
import type { Filter } from './image';

// One scanned page. `raw` is the flattened crop before any filter, so the
// filter can be changed later without losing quality.
export type Page = {
  id: string;
  raw: string; // jpeg data URL
  out: string; // jpeg data URL with filter applied
  filter: Filter;
  text?: string;
  words?: OcrWord[];
};

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };

export type Doc = {
  id: string;
  name: string;
  mode: ScanMode;
  created: number;
  updated: number;
  pages: Page[];
  proof?: { sig: string; hash: string; at: number };
};

export type ScanMode = 'document' | 'whiteboard' | 'book' | 'idcard' | 'card';

const PREFIX = 'doc:';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function listDocs(): Promise<Doc[]> {
  const ks = (await keys()).filter((k) => String(k).startsWith(PREFIX));
  const docs = await Promise.all(ks.map((k) => get<Doc>(k)));
  return docs.filter(Boolean).sort((a, b) => b!.updated - a!.updated) as Doc[];
}

export const getDoc = (id: string) => get<Doc>(PREFIX + id);
export const saveDoc = (d: Doc) => set(PREFIX + d.id, { ...d, updated: Date.now() });
export const deleteDoc = (id: string) => del(PREFIX + id);

export function defaultName(mode: ScanMode) {
  const d = new Date();
  const label = { document: 'Scan', whiteboard: 'Whiteboard', book: 'Book', idcard: 'ID card', card: 'Card' }[mode];
  return `${label} ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${d
    .toTimeString()
    .slice(0, 5)}`;
}
