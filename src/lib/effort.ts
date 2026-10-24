import { useSyncExternalStore } from 'react';

// One shared setting, lightest (1) to heaviest (6). It trades speed for care in
// corner finding, output size and OCR prep. Nothing here calls a server.
export type Effort = 1 | 2 | 3 | 4 | 5 | 6;
export const EFFORTS: Effort[] = [1, 2, 3, 4, 5, 6];

export type Profile = {
  detect: number; // long side of the working copy used to find corners
  edges: boolean; // also search for straight paper edges, not only brightness
  maxSide: number; // long side of the flattened page
  ocrScale: number; // upscale before OCR; small print reads better larger
  ocrGray: boolean; // OCR a contrast-stretched gray copy
};

export const profiles: Record<Effort, Profile> = {
  1: { detect: 160, edges: false, maxSide: 1400, ocrScale: 1, ocrGray: false },
  2: { detect: 240, edges: false, maxSide: 1800, ocrScale: 1, ocrGray: false },
  3: { detect: 320, edges: true, maxSide: 2400, ocrScale: 1, ocrGray: false },
  4: { detect: 480, edges: true, maxSide: 2400, ocrScale: 1, ocrGray: true },
  5: { detect: 640, edges: true, maxSide: 3000, ocrScale: 1.5, ocrGray: true },
  6: { detect: 800, edges: true, maxSide: 3600, ocrScale: 2, ocrGray: true },
};

const KEY = 'pl-effort';
const listeners = new Set<() => void>();
let current: Effort = read();

function read(): Effort {
  try {
    const n = Number(localStorage.getItem(KEY));
    if (n >= 1 && n <= 6 && Number.isInteger(n)) return n as Effort;
  } catch {
    /* storage blocked */
  }
  return 3;
}

export const getEffort = () => current;

export function setEffort(e: Effort) {
  current = e;
  try {
    localStorage.setItem(KEY, String(e));
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useEffort = () => useSyncExternalStore(subscribe, getEffort, getEffort);
