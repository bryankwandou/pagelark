import { useEffect, useRef, useState } from 'react';
import { ocrDefaults, useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { SignPad } from '../components/SignPad';
import { applyFilter, loadImage, rotate, toCanvas, toJpeg, type Filter } from '../lib/image';
import { deleteDoc, getDoc, saveDoc, type Doc } from '../lib/store';
import { recognize } from '../lib/ocr';
import { buildPdf, download, sha256, shareOrDownload, type PageSize } from '../lib/pdf';
import { explorer } from '../lib/explorer';
import { go } from '../router';

type Tab = 'pages' | 'text' | 'sign' | 'export' | 'proof';
const FILTERS: Filter[] = ['printable', 'original', 'gray', 'bw', 'color'];
const TABS: Tab[] = ['pages', 'text', 'sign', 'export', 'proof'];

async function canvasFrom(url: string) {
  const img = await loadImage(url);
  return toCanvas(img, img.naturalWidth, img.naturalHeight);
}

export function DocView({ id, initialTab }: { id: string; initialTab?: string }) {
  const { t, lang } = useT();
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState<Tab>((TABS as string[]).includes(initialTab ?? '') ? (initialTab as Tab) : 'pages');
  const [busy, setBusy] = useState<string | null>(null);
  const filterSeq = useRef(0);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [ocrLang, setOcrLang] = useState(() => ocrDefaults[lang]);
  const [size, setSize] = useState<PageSize>('a4');
  const [padOpen, setPadOpen] = useState(false);
  const [stamp, setStamp] = useState<{ kind: 'img' | 'text'; value: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDoc(id).then((d) => setDoc(d ?? null));
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(h);
  }, [toast]);

  if (doc === undefined) return <div className="screen center"><span className="spinner" /></div>;
  if (doc === null)
    return (
      <div className="screen center">
        <p>Not found.</p>
        <a className="btn" href="#/app">{t.back}</a>
      </div>
    );

  const page = doc.pages[Math.min(cur, doc.pages.length - 1)];
  const update = async (d: Doc) => {
    setDoc(d);
    await saveDoc(d);
  };
  const setPage = (i: number, patch: Partial<Doc['pages'][number]>) =>
    update({ ...doc, pages: doc.pages.map((p, j) => (j === i ? { ...p, ...patch } : p)), proof: undefined });

  // Quick taps can overlap; only the most recent filter choice may land.
  const changeFilter = async (f: Filter) => {
    const ticket = ++filterSeq.current;
    setBusy(t.working);
    const out = toJpeg(applyFilter(await canvasFrom(page.raw), f), 0.88);
    if (ticket !== filterSeq.current) return;
    await setPage(cur, { filter: f, out });
    setBusy(null);
  };

  const doRotate = async () => {
    setBusy(t.working);
    const raw = toJpeg(rotate(await canvasFrom(page.raw), 90), 0.9);
    const out = toJpeg(rotate(await canvasFrom(page.out), 90), 0.88);
    await setPage(cur, { raw, out, words: undefined });
    setBusy(null);
  };

  const movePage = (dir: -1 | 1) => {
    const j = cur + dir;
    if (j < 0 || j >= doc.pages.length) return;
    const pages = [...doc.pages];
    [pages[cur], pages[j]] = [pages[j], pages[cur]];
    update({ ...doc, pages, proof: undefined });
    setCur(j);
  };

  const removePage = async () => {
    if (doc.pages.length === 1) {
      if (!confirm(t.deleteConfirm)) return;
      await deleteDoc(doc.id);
      return go('/app');
    }
    await update({ ...doc, pages: doc.pages.filter((_, j) => j !== cur), proof: undefined });
    setCur(Math.max(0, cur - 1));
  };

  const runOcr = async () => {
    setBusy(t.reading);
    setErr(null);
    try {
      const pages = [...doc.pages];
      for (let i = 0; i < pages.length; i++) {
        const r = await recognize(pages[i].out, ocrLang, (p) => setProgress((i + p) / pages.length));
        pages[i] = { ...pages[i], text: r.text, words: r.words };
      }
      await update({ ...doc, pages, proof: undefined });
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    }
    setProgress(0);
    setBusy(null);
  };

  const allText = doc.pages.map((p) => p.text ?? '').join('\n\n').trim();

  // Signature / text placement: tap on the page image.
  const placeAt = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!stamp) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    setBusy(t.working);
    const paint = async (url: string, q: number) => {
      const c = await canvasFrom(url);
      const ctx = c.getContext('2d')!;
      if (stamp.kind === 'img') {
        const s = await loadImage(stamp.value);
        const w = c.width * 0.28, h = (s.naturalHeight / s.naturalWidth) * w;
        ctx.drawImage(s, fx * c.width - w / 2, fy * c.height - h / 2, w, h);
      } else {
        const fs = Math.round(c.width * 0.022);
        ctx.font = `${fs}px "Inter", system-ui, sans-serif`;
        ctx.fillStyle = '#111';
        ctx.textBaseline = 'middle';
        ctx.fillText(stamp.value, fx * c.width, fy * c.height);
      }
      return toJpeg(c, q);
    };
    await setPage(cur, { raw: await paint(page.raw, 0.9), out: await paint(page.out, 0.88) });
    setStamp(null);
    setBusy(null);
  };

  const exportPdf = async (share: boolean) => {
    setBusy(t.working);
    const blob = await buildPdf(doc, size);
    if (share) await shareOrDownload(blob, `${doc.name}.pdf`);
    else download(blob, `${doc.name}.pdf`);
    setBusy(null);
  };

  const doStamp = async () => {
    setErr(null);
    setBusy(t.working);
    try {
      const blob = await buildPdf(doc, size);
      const hash = await sha256(blob);
      const { stampHash } = await import('../lib/solana');
      const sig = await stampHash(hash);
      // Keep the exact bytes that were stamped: re-exporting later would
      // produce a different file (jsPDF embeds a creation date).
      download(blob, `${doc.name}.pdf`);
      await update({ ...doc, proof: { sig, hash, at: Date.now() } });
    } catch (e) {
      const m = (e as Error).message;
      setErr(m === 'NO_WALLET' ? t.noWallet : m);
    }
    setBusy(null);
  };

  const rename = () => {
    const n = prompt(t.rename, doc.name);
    if (n && n.trim()) update({ ...doc, name: n.trim() });
  };

  const tabLabel: Record<Tab, string> = {
    pages: t.pageOf(cur + 1, doc.pages.length),
    text: 'OCR',
    sign: t.fillSign,
    export: t.savePdf,
    proof: t.proof,
  };

  return (
    <div className="doc-view">
      <header className="doc-head">
        <button className="icon-btn" onClick={() => go('/app')} aria-label={t.back}><Icon name="back" /></button>
        <button className="doc-name" onClick={rename} title={t.rename}>
          {doc.name} <Icon name="edit" size={16} />
        </button>
        <button className="btn primary sm" onClick={() => exportPdf(true)}><Icon name="share" size={18} /> <span className="hide-sm">{t.share}</span></button>
      </header>

      <div className="doc-body">
        <section className="stage">
          <div className={`stage-page ${stamp ? 'placing' : ''}`}>
            <img key={page.out.length + page.id} src={page.out} alt={tabLabel.pages} onClick={placeAt} className="fade-in" />
          </div>
          {stamp && <p className="hint">{t.place} <button className="link" onClick={() => setStamp(null)}>{t.cancel}</button></p>}
          <div className="strip">
            {doc.pages.map((p, i) => (
              <button key={p.id} className={`strip-item ${i === cur ? 'active' : ''}`} onClick={() => setCur(i)}>
                <img src={p.out} alt="" />
                <span>{i + 1}</span>
              </button>
            ))}
            <button className="strip-item add" onClick={() => go(`/scan?add=${doc.id}`)} aria-label={t.addPage}>
              <Icon name="plus" />
            </button>
          </div>
        </section>

        <aside className="panel">
          <nav className="tabs" role="tablist">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {{ pages: t.tabPages, text: 'OCR', sign: t.sign, export: t.tabExport, proof: t.proof }[k]}
              </button>
            ))}
          </nav>

          {tab === 'pages' && (
            <div className="panel-body">
              <p className="label">{tabLabel.pages}</p>
              <div className="filter-row">
                {FILTERS.map((f) => (
                  <button key={f} className={`filter ${page.filter === f ? 'active' : ''}`} onClick={() => changeFilter(f)}>
                    <span className={`swatch sw-${f}`} />
                    {t.filters[f]}
                  </button>
                ))}
              </div>
              <div className="tool-grid">
                <button onClick={doRotate}><Icon name="rotate" /> {t.rotate}</button>
                <button onClick={() => movePage(-1)} disabled={cur === 0}><Icon name="up" /> {t.movedUp}</button>
                <button onClick={() => movePage(1)} disabled={cur === doc.pages.length - 1}><Icon name="down" /> {t.movedDown}</button>
                <button onClick={() => go(`/scan?add=${doc.id}`)}><Icon name="plus" /> {t.addPage}</button>
                <button className="danger" onClick={removePage}><Icon name="trash" /> {t.removePage}</button>
              </div>
            </div>
          )}

          {tab === 'text' && (
            <div className="panel-body">
              <label className="field">
                <span className="label">{t.ocrLang}</span>
                <select value={ocrLang} onChange={(e) => setOcrLang(e.target.value)}>
                  <option value="eng+ind">English + Indonesia</option>
                  <option value="eng">English</option>
                  <option value="ind">Indonesia</option>
                  <option value="spa+eng">Español + English</option>
                  <option value="spa">Español</option>
                  <option value="fra+eng">Français + English</option>
                  <option value="fra">Français</option>
                  <option value="por+eng">Português + English</option>
                  <option value="por">Português</option>
                  <option value="deu">Deutsch</option>
                </select>
              </label>
              <button className="btn primary wide" onClick={runOcr}><Icon name="text" /> {t.readText}</button>
              {allText ? (
                <>
                  <textarea className="ocr-text" readOnly value={allText} />
                  <div className="btn-row">
                    <button className="btn" onClick={async () => { await navigator.clipboard.writeText(allText); setToast(t.copied); }}>
                      <Icon name="copy" size={18} /> {t.copyText}
                    </button>
                    <button className="btn" onClick={() => download(new Blob([allText], { type: 'text/plain' }), `${doc.name}.txt`)}>
                      <Icon name="download" size={18} /> {t.exportText}
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted small">{t.noText}</p>
              )}
            </div>
          )}

          {tab === 'sign' && (
            <div className="panel-body">
              <button className="btn primary wide" onClick={() => setPadOpen(true)}><Icon name="sign" /> {t.drawSign}</button>
              <button
                className="btn wide"
                onClick={() => {
                  const v = prompt(t.typeHere);
                  if (v) setStamp({ kind: 'text', value: v });
                }}
              >
                <Icon name="text" /> {t.addText}
              </button>
              <p className="muted small">{t.place}</p>
            </div>
          )}

          {tab === 'export' && (
            <div className="panel-body">
              <label className="field">
                <span className="label">{t.pageSize}</span>
                <select value={size} onChange={(e) => setSize(e.target.value as PageSize)}>
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="fit">{t.sizeFit}</option>
                </select>
              </label>
              <button className="btn primary wide" onClick={() => exportPdf(false)}><Icon name="pdf" /> {t.savePdf}</button>
              <button className="btn wide" onClick={() => exportPdf(true)}><Icon name="share" /> {t.share}</button>
              <button
                className="btn wide"
                onClick={() => doc.pages.forEach((p, i) => fetch(p.out).then((r) => r.blob()).then((b) => download(b, `${doc.name}-${i + 1}.jpg`)))}
              >
                <Icon name="image" /> {t.exportImages}
              </button>
              {!allText && <p className="muted small">{t.noText}</p>}
            </div>
          )}

          {tab === 'proof' && (
            <div className="panel-body">
              <p className="small">{t.proofBody}</p>
              {doc.proof ? (
                <div className="proof-card">
                  <strong><Icon name="shield" size={18} /> {t.stamped}</strong>
                  <code>{doc.proof.hash}</code>
                  <a href={explorer(doc.proof.sig)} target="_blank" rel="noreferrer">{doc.proof.sig.slice(0, 20)}…</a>
                  <a className="link" href={`#/verify?sig=${doc.proof.sig}`}>{t.verify}</a>
                </div>
              ) : (
                <button className="btn primary wide" onClick={doStamp}><Icon name="shield" /> {t.stamp}</button>
              )}
            </div>
          )}
          {err && <p className="error">{err}</p>}
        </aside>
      </div>

      {padOpen && (
        <SignPad
          onCancel={() => setPadOpen(false)}
          onDone={(png) => {
            setPadOpen(false);
            setStamp({ kind: 'img', value: png });
          }}
        />
      )}
      {busy && (
        <div className="busy">
          <span className="spinner" /> {busy}
          {progress > 0 && <span className="bar"><i style={{ width: `${progress * 100}%` }} /></span>}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
