import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { Logo, LogoMark } from '../components/Logo';
import { LangSwitch } from '../components/LangSwitch';
import { applyFilter } from '../lib/image';
import { drawDemoPhoto } from '../lib/demo';
import { go } from '../router';

// Reveal-on-scroll for every element with [data-reveal].
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('in'));
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
      { threshold: 0.15 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
}

function BeforeAfter() {
  const { t } = useT();
  const [urls, setUrls] = useState<[string, string] | null>(null);
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    // run after first paint so the hero animates first
    const h = setTimeout(() => {
      const photo = drawDemoPhoto();
      setUrls([photo.toDataURL('image/jpeg', 0.85), applyFilter(photo, 'printable').toDataURL('image/jpeg', 0.85)]);
    }, 60);
    return () => clearTimeout(h);
  }, []);

  // gentle self-demo until the visitor touches it
  useEffect(() => {
    if (!urls) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (dragging.current) return;
      setPos(50 + Math.sin((now - t0) / 1400) * 28);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [urls]);

  const set = (x: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  };

  return (
    <div
      ref={box}
      className="ba"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        set(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && set(e.clientX)}
      onPointerUp={() => {}}
      role="slider"
      aria-label={t.beforeAfter}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => {
        dragging.current = true;
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5));
        if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5));
      }}
    >
      {urls ? (
        <>
          <img src={urls[1]} alt={t.after} draggable={false} />
          <img src={urls[0]} alt={t.before} draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <span className="ba-line" style={{ left: `${pos}%` }}><i /></span>
          <span className="ba-tag l">{t.before}</span>
          <span className="ba-tag r">{t.after}</span>
        </>
      ) : (
        <div className="skeleton tall" />
      )}
    </div>
  );
}

function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`tilt ${className ?? ''}`}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        ref.current!.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
        ref.current!.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
        ref.current!.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
      }}
      onPointerLeave={() => (ref.current!.style.transform = '')}
    >
      {children}
    </div>
  );
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (n: number) => {
        const k = Math.min(1, (n - t0) / 1100);
        setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{v}{suffix}</span>;
}

export function Landing() {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  useReveal();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const featIcons = ['wand', 'image', 'text', 'pdf', 'sign', 'camera', 'files', 'shield'];

  return (
    <div className="landing">
      <header className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="#/" className="nav-logo"><Logo /></a>
        <nav className="nav-links">
          <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.navFeatures}</a>
          <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.navHow}</a>
          <a href="#proof" onClick={(e) => { e.preventDefault(); document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.navProof}</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.navFaq}</a>
        </nav>
        <div className="nav-right">
          <LangSwitch compact />
          <button className="btn primary sm" onClick={() => go('/app')}>{t.openApp}</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow rise">Pagelark</p>
          <h1 className="rise d1">{t.tagline}</h1>
          <p className="lead rise d2">{t.heroSub}</p>
          <div className="hero-cta rise d3">
            <button className="btn primary lg" onClick={() => go('/scan')}><Icon name="camera" /> {t.startScanning}</button>
            <button className="btn ghost lg" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>{t.seeHow}</button>
          </div>
          <ul className="stats rise d4">
            <li><b>$<Counter to={0} /></b><span>{t.stat1}</span></li>
            <li><b><Counter to={0} /></b><span>{t.stat2}</span></li>
            <li><b><Counter to={100} suffix="+" /></b><span>{t.stat3}</span></li>
          </ul>
        </div>
        <Tilt className="hero-visual rise d2">
          <div className="device">
            <BeforeAfter />
          </div>
          <p className="ba-hint">{t.beforeAfter}</p>
        </Tilt>
      </section>

      <section className="why" data-reveal>
        <h2>{t.whyTitle}</h2>
        <p>{t.whyBody}</p>
      </section>

      <section id="features" className="features">
        <header data-reveal>
          <h2>{t.featTitle}</h2>
          <p className="muted">{t.featSub}</p>
        </header>
        <div className="feat-grid">
          {t.feats.map(([h, b], i) => (
            <Tilt key={h} className="feat" >
              <div data-reveal style={{ transitionDelay: `${i * 50}ms` }}>
                <span className="feat-icon"><Icon name={featIcons[i]} /></span>
                <h3>{h}</h3>
                <p>{b}</p>
              </div>
            </Tilt>
          ))}
        </div>
      </section>

      <section id="how" className="how">
        <h2 data-reveal>{t.howTitle}</h2>
        <ol>
          {t.how.map(([h, b], i) => (
            <li key={h} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="step">{i + 1}</span>
              <h3>{h}</h3>
              <p>{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="proof" className="proof" data-reveal>
        <div>
          <h2>{t.proofTitle}</h2>
          <p>{t.proofLead}</p>
          <a className="btn ghost" href="#/verify"><Icon name="shield" /> {t.verifyTitle}</a>
        </div>
        <div className="chain" aria-hidden="true">
          <div className="chain-file"><Icon name="pdf" size={28} /> letter.pdf</div>
          <div className="chain-arrow" />
          <code className="chain-hash">sha256 9f2c…e41a</code>
          <div className="chain-arrow" />
          <div className="chain-block">Solana devnet<br /><small>{t.memoSigned}</small></div>
        </div>
      </section>

      <section id="faq" className="faq">
        <h2 data-reveal>{t.faqTitle}</h2>
        {t.faq.map(([q, a], i) => (
          <div key={q} className={`qa ${open === i ? 'open' : ''}`} data-reveal>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {q} <Icon name="plus" size={18} />
            </button>
            <div className="qa-a"><p>{a}</p></div>
          </div>
        ))}
      </section>

      <section className="cta" data-reveal>
        <LogoMark size={56} />
        <h2>{t.ctaTitle}</h2>
        <p>{t.ctaBody}</p>
        <button className="btn primary lg" onClick={() => go('/scan')}><Icon name="camera" /> {t.startScanning}</button>
      </section>

      <footer className="foot">
        <Logo size={22} />
        <p className="muted small">{t.footer}</p>
        <p className="small">
          <a href="https://github.com/bryankwandou/pagelark" target="_blank" rel="noreferrer">GitHub</a> · <a href="#/verify">{t.verify}</a>
        </p>
      </footer>
    </div>
  );
}
