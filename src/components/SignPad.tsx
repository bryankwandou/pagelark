import { useEffect, useRef } from 'react';
import { useT } from '../lib/i18n';

/** Draw area that returns a transparent PNG trimmed to the ink. */
export function SignPad({ onDone, onCancel }: { onDone: (png: string) => void; onCancel: () => void }) {
  const { t } = useT();
  const cv = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inked = useRef(false);

  useEffect(() => {
    const c = cv.current!;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = '#13205c';
    ctx.lineWidth = 2.6;
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const trim = () => {
    const c = cv.current!;
    const ctx = c.getContext('2d')!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
    if (x1 <= x0) return null;
    const o = document.createElement('canvas');
    o.width = x1 - x0 + 8;
    o.height = y1 - y0 + 8;
    o.getContext('2d')!.drawImage(c, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  };

  return (
    <div className="modal" role="dialog" aria-label={t.drawSign}>
      <div className="modal-card">
        <h3>{t.drawSign}</h3>
        <canvas
          ref={cv}
          className="signpad"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            last.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!last.current) return;
            const p = pos(e);
            const ctx = cv.current!.getContext('2d')!;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
            inked.current = true;
          }}
          onPointerUp={() => (last.current = null)}
        />
        <div className="modal-actions">
          <button
            className="btn ghost"
            onClick={() => {
              const c = cv.current!;
              c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
              inked.current = false;
            }}
          >
            {t.clear}
          </button>
          <span className="grow" />
          <button className="btn ghost" onClick={onCancel}>{t.cancel}</button>
          <button
            className="btn primary"
            onClick={() => {
              const png = inked.current ? trim() : null;
              if (png) onDone(png);
            }}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
