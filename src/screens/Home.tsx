import { useEffect, useMemo, useState } from 'react';
import { useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { LangSwitch } from '../components/LangSwitch';
import { listDocs, type Doc } from '../lib/store';
import type { Doc as _D } from '../lib/store';
import { go } from '../router';

export function Home({ tab }: { tab: 'home' | 'files' }) {
  const { t } = useT();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(tab === 'files');

  useEffect(() => {
    listDocs().then(setDocs);
  }, []);

  const shown = useMemo(() => {
    if (!docs) return [];
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter(
      (d) => d.name.toLowerCase().includes(s) || d.pages.some((p) => p.text?.toLowerCase().includes(s)),
    );
  }, [docs, q]);

  const share = async (d: _D) => {
    const { buildPdf, shareOrDownload } = await import('../lib/pdf');
    return shareOrDownload(await buildPdf(d), `${d.name}.pdf`);
  };
  const [first, ...rest] = shown;

  return (
    <div className="app-shell">
      <aside className="side">
        <a href="#/" className="side-logo"><Logo /></a>
        <button className="btn primary wide" onClick={() => go('/scan')}>
          <Icon name="camera" size={20} /> {t.scan}
        </button>
        <a className={`side-link ${tab === 'home' ? 'active' : ''}`} href="#/app"><Icon name="home" /> {t.home}</a>
        <a className={`side-link ${tab === 'files' ? 'active' : ''}`} href="#/files"><Icon name="files" /> {t.files}</a>
        <a className="side-link" href="#/verify"><Icon name="shield" /> {t.verify}</a>
        <div className="side-foot"><LangSwitch /></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <a href="#/" className="topbar-logo"><Logo size={26} /></a>
          {searching ? (
            <label className="search">
              <Icon name="search" size={18} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} />
              <button className="icon-btn" onClick={() => { setQ(''); setSearching(false); }} aria-label={t.cancel}>
                <Icon name="close" size={18} />
              </button>
            </label>
          ) : (
            <div className="topbar-actions">
              <button className="icon-btn" onClick={() => setSearching(true)} aria-label={t.search}>
                <Icon name="search" />
              </button>
              <span className="mobile-only"><LangSwitch compact /></span>
            </div>
          )}
        </header>

        {docs === null ? (
          <div className="skeleton-list">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>
        ) : docs.length === 0 ? (
          <section className="empty">
            <div className="empty-art"><span /><span /><span /></div>
            <h2>{t.emptyTitle}</h2>
            <p className="muted">{t.emptyBody}</p>
            <button className="btn primary" onClick={() => go('/scan')}><Icon name="camera" size={20} /> {t.startScanning}</button>
          </section>
        ) : (
          <>
            {first && tab === 'home' && !q && (
              <section className="hero-doc rise">
                <p className="eyebrow">{t.recent}</p>
                <h2 className="doc-title">{first.name}</h2>
                <p className="muted small">{t.pages(first.pages.length)} · {new Date(first.updated).toLocaleString()}</p>
                <div className="hero-doc-body">
                  <button className="paper big" onClick={() => go(`/doc/${first.id}`)}>
                    <img src={first.pages[0]?.out} alt={first.name} />
                  </button>
                  <div className="action-list">
                    <button onClick={() => share(first)}><Icon name="share" /> {t.share}</button>
                    <button onClick={() => go(`/doc/${first.id}?tab=text`)}><Icon name="text" /> {t.readText}</button>
                    <button onClick={() => go(`/doc/${first.id}?tab=sign`)}><Icon name="sign" /> {t.fillSign}</button>
                    <button onClick={() => go(`/doc/${first.id}`)}><Icon name="more" /> {t.more}</button>
                  </div>
                </div>
              </section>
            )}
            <section className="doc-grid">
              {(tab === 'home' && !q ? rest : shown).map((d, i) => (
                <article key={d.id} className="doc-card rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <button className="paper" onClick={() => go(`/doc/${d.id}`)}>
                    <img src={d.pages[0]?.out} alt="" loading="lazy" />
                  </button>
                  <div className="doc-card-body">
                    <h3>{d.name}</h3>
                    <p className="muted small">
                      {t.pages(d.pages.length)} · {new Date(d.updated).toLocaleDateString()}
                      {d.proof && <span className="badge"><Icon name="shield" size={12} /> devnet</span>}
                    </p>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => share(d)} aria-label={t.share}><Icon name="share" /></button>
                      <button className="icon-btn" onClick={() => go(`/doc/${d.id}?tab=text`)} aria-label={t.readText}><Icon name="text" /></button>
                      <button className="icon-btn" onClick={() => go(`/doc/${d.id}?tab=sign`)} aria-label={t.fillSign}><Icon name="sign" /></button>
                      <button className="icon-btn" onClick={() => go(`/doc/${d.id}`)} aria-label={t.more}><Icon name="more" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>

      <nav className="bottom-nav">
        <a className={tab === 'home' ? 'active' : ''} href="#/app"><Icon name="home" /> <span>{t.home}</span></a>
        <button className="fab" onClick={() => go('/scan')} aria-label={t.scan}><Icon name="camera" size={28} /></button>
        <a className={tab === 'files' ? 'active' : ''} href="#/files"><Icon name="files" /> <span>{t.files}</span></a>
      </nav>
    </div>
  );
}
