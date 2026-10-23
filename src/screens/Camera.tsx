import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { CropEditor } from '../components/CropEditor';
import { applyFilter, loadImage, toJpeg, warp, type Filter, type Quad } from '../lib/image';
import { defaultName, getDoc, saveDoc, uid, type Doc, type Page, type ScanMode } from '../lib/store';
import { go } from '../router';

const MODES: ScanMode[] = ['whiteboard', 'book', 'document', 'idcard', 'card'];
export const modeFilter: Record<ScanMode, Filter> = {
  document: 'printable',
  whiteboard: 'printable',
  book: 'printable',
  idcard: 'color',
  card: 'color',
};

export function Camera({ addTo }: { addTo?: string }) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ScanMode>('document');
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [torch, setTorch] = useState(false);
  const [pending, setPending] = useState<HTMLImageElement[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (!alive) return s.getTracks().forEach((tr) => tr.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setCamOk(true);
      } catch {
        setCamOk(false);
      }
    })();
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      /* device has no torch */
    }
  };

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const img = await loadImage(c.toDataURL('image/jpeg', 0.92));
    setPending((p) => [...p, img]);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const imgs: HTMLImageElement[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      imgs.push(await loadImage(URL.createObjectURL(f)));
    }
    setPending((p) => [...p, ...imgs]);
  };

  const accept = async (q: Quad) => {
    const img = pending[0];
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    const flat = warp(img, q);
    const f = modeFilter[mode];
    const page: Page = { id: uid(), raw: toJpeg(flat, 0.9), out: toJpeg(applyFilter(flat, f), 0.88), filter: f };
    setPages((p) => [...p, page]);
    setPending((p) => p.slice(1));
    setBusy(false);
  };

  const finish = async () => {
    if (!pages.length) return;
    setBusy(true);
    let doc: Doc | undefined = addTo ? await getDoc(addTo) : undefined;
    if (doc) doc = { ...doc, pages: [...doc.pages, ...pages] };
    else doc = { id: uid(), name: defaultName(mode), mode, created: Date.now(), updated: Date.now(), pages };
    await saveDoc(doc);
    go(`/doc/${doc.id}`);
  };

  if (pending.length) {
    return (
      <div className="screen dark">
        {busy && <div className="busy"><span className="spinner" /> {t.working}</div>}
        <CropEditor key={pending[0].src} img={pending[0]} onDone={accept} onCancel={() => setPending((p) => p.slice(1))} />
      </div>
    );
  }

  return (
    <div className="screen dark camera">
      <header className="cam-top">
        <button className="icon-btn" onClick={() => go(addTo ? `/doc/${addTo}` : '/app')} aria-label={t.home}>
          <Icon name="home" />
        </button>
        <span className="privacy-pill"><Icon name="shield" size={16} /> {t.privacy}</span>
        <button className={`icon-btn ${torch ? 'on' : ''}`} onClick={toggleTorch} aria-label={t.flash}>
          <Icon name="flash" />
        </button>
      </header>

      <div className="viewfinder">
        <video ref={video} playsInline muted />
        {camOk === false && <p className="cam-msg">{t.noCamera}</p>}
        {camOk && <div className={`guide guide-${mode}`}><span /><span /><span /><span /></div>}
        {camOk && <div className="scanline" />}
        {flash && <div className="flash" />}
      </div>

      <nav className="modes" aria-label={t.scanMode}>
        {MODES.map((m) => (
          <button key={m} className={m === mode ? 'active' : ''} onClick={() => setMode(m)}>
            {t.modes[m]}
          </button>
        ))}
      </nav>

      <footer className="cam-bottom">
        <button className="icon-btn big" onClick={() => fileIn.current?.click()} aria-label={t.importPhoto}>
          <Icon name="image" size={26} />
        </button>
        <button className="shutter" onClick={shoot} disabled={!camOk} aria-label={t.scan}>
          <span />
        </button>
        <button className="thumb-stack" onClick={finish} disabled={!pages.length} aria-label={t.done}>
          {pages.length ? (
            <>
              <img src={pages[pages.length - 1].out} alt="" />
              <b>{pages.length}</b>
            </>
          ) : (
            <span className="thumb-empty" />
          )}
        </button>
        <input ref={fileIn} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </footer>
      {busy && <div className="busy"><span className="spinner" /> {t.working}</div>}
    </div>
  );
}
