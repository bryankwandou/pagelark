import { useEffect, useRef, useState } from 'react';
import { detectQuad, type Quad } from '../lib/image';
import { useT } from '../lib/i18n';
import { getEffort, useEffort } from '../lib/effort';
import { Icon } from './Icon';
import { EffortSlider } from './EffortSlider';

/** Shows the photo with four draggable corner handles. */
export function CropEditor({
  img,
  onDone,
  onCancel,
}: {
  img: HTMLImageElement;
  onDone: (q: Quad) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const effort = useEffort();
  const [q, setQ] = useState<Quad>(() => detectQuad(img, getEffort()));
  const box = useRef<HTMLDivElement>(null);
  const firstEffort = useRef(effort);

  // Moving the slider re-runs detection at the new effort.
  useEffect(() => {
    if (effort === firstEffort.current) return;
    firstEffort.current = effort;
    setQ(detectQuad(img, effort));
  }, [effort, img]);
  const [scale, setScale] = useState(1);
  const drag = useRef<number | null>(null);
  const W = img.naturalWidth, H = img.naturalHeight;

  useEffect(() => {
    const fit = () => {
      const el = box.current?.parentElement;
      if (!el) return;
      setScale(Math.min((el.clientWidth - 32) / W, (el.clientHeight - 32) / H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [W, H]);

  const move = (e: React.PointerEvent) => {
    if (drag.current === null || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(W, Math.max(0, (e.clientX - r.left) / scale));
    const y = Math.min(H, Math.max(0, (e.clientY - r.top) / scale));
    const n = [...q] as Quad;
    n[drag.current] = { x, y };
    setQ(n);
  };

  const pts = q.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');

  return (
    <div className="crop">
      <header className="sheet-head">
        <button className="icon-btn" onClick={onCancel} aria-label={t.retake}>
          <Icon name="close" />
        </button>
        <div>
          <strong>{t.adjust}</strong>
          <p className="muted small">{t.adjustHint}</p>
        </div>
        <span />
      </header>
      <div className="crop-stage">
        <div
          ref={box}
          className="crop-box"
          style={{ width: W * scale, height: H * scale }}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
        >
          <img src={img.src} alt="" draggable={false} />
          <svg width={W * scale} height={H * scale}>
            <polygon points={pts} className="crop-poly" />
          </svg>
          {q.map((p, i) => (
            <span
              key={i}
              className="handle"
              style={{ left: p.x * scale, top: p.y * scale }}
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                drag.current = i;
              }}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              role="slider"
              aria-label={`corner ${i + 1}`}
              aria-valuenow={Math.round(p.x)}
            />
          ))}
        </div>
      </div>
      <footer className="crop-foot">
        <EffortSlider dark />
        <button className="chip" onClick={() => setQ(detectQuad(img, effort))}>
          <Icon name="wand" size={18} /> {t.autoDetect}
        </button>
        <button
          className="chip"
          onClick={() => setQ([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }])}
        >
          {t.fullPage}
        </button>
        <button className="btn primary" onClick={() => onDone(q)}>
          {t.continue}
        </button>
      </footer>
    </div>
  );
}
