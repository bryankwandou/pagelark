import { useEffect, useRef } from 'react';
import { EFFORTS, setEffort, useEffort, type Effort } from '../lib/effort';
import { useT } from '../lib/i18n';

/** Six-step effort control. Drag, use the arrow keys, or scroll the wheel over it. */
export function EffortSlider({ dark = false }: { dark?: boolean }) {
  const { t } = useT();
  const e = useEffort();
  const ref = useRef<HTMLDivElement>(null);

  // React's onWheel is passive, so the page would scroll too; bind it ourselves.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (Math.abs(ev.deltaY) < 1) return;
      ev.preventDefault();
      const n = Math.min(6, Math.max(1, e + (ev.deltaY > 0 ? 1 : -1))) as Effort;
      if (n !== e) setEffort(n);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [e]);

  const pct = ((e - 1) / 5) * 100;
  return (
    <div ref={ref} className={`effort ${dark ? 'on-dark' : ''}`}>
      <div className="effort-head">
        <span>{t.effort}</span>
        <strong>{t.effortLevels[e - 1]}</strong>
      </div>
      <div className="effort-track" style={{ '--p': `${pct / 100}` } as React.CSSProperties}>
        <input
          type="range"
          min={1}
          max={6}
          step={1}
          value={e}
          onChange={(ev) => setEffort(Number(ev.target.value) as Effort)}
          aria-label={t.effort}
          aria-valuetext={t.effortLevels[e - 1]}
        />
        {EFFORTS.map((n) => (
          <i key={n} className={n <= e ? 'on' : ''} style={{ '--i': `${(n - 1) / 5}` } as React.CSSProperties} />
        ))}
      </div>
      <p className="effort-hint">{t.effortHints[e - 1]}</p>
    </div>
  );
}
