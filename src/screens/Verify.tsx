import { useState } from 'react';
import { useT } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { sha256 } from '../lib/pdf';
import { explorer } from '../lib/explorer';
import { go } from '../router';

export function Verify({ sig: initial }: { sig?: string }) {
  const { t } = useT();
  const [sig, setSig] = useState(initial ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<
    | { kind: 'match' | 'mismatch'; signer: string; time: number | null; hash: string; local: string }
    | { kind: 'none' | 'error'; msg: string }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!file || !sig.trim()) return;
    setBusy(true);
    setRes(null);
    try {
      const { readStamp } = await import('../lib/solana');
      const [local, onchain] = await Promise.all([sha256(file), readStamp(sig.trim())]);
      if (!onchain) setRes({ kind: 'none', msg: t.notFound });
      else setRes({ kind: onchain.hash === local ? 'match' : 'mismatch', ...onchain, local });
    } catch (e) {
      setRes({ kind: 'error', msg: (e as Error).message });
    }
    setBusy(false);
  };

  return (
    <div className="verify">
      <header className="doc-head">
        <button className="icon-btn" onClick={() => go('/app')} aria-label={t.back}><Icon name="back" /></button>
        <strong>{t.verifyTitle}</strong>
        <span />
      </header>
      <main className="verify-card rise">
        <p className="muted">{t.verifyBody}</p>
        <label className={`drop ${file ? 'has' : ''}`}>
          <Icon name="pdf" size={28} />
          <span>{file ? file.name : t.chooseFile}</span>
          <input type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="field">
          <span className="label">{t.signature}</span>
          <input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="5h3…" spellCheck={false} />
        </label>
        <button className="btn primary wide" disabled={!file || !sig || busy} onClick={check}>
          {busy ? <span className="spinner" /> : <Icon name="shield" />} {t.verify}
        </button>
        {res && (res.kind === 'match' || res.kind === 'mismatch') && (
          <div className={`result ${res.kind}`}>
            <strong>{res.kind === 'match' ? t.match : t.mismatch}</strong>
            <dl>
              <dt>{t.signer}</dt>
              <dd><code>{res.signer}</code></dd>
              <dt>{t.when}</dt>
              <dd>{res.time ? new Date(res.time * 1000).toLocaleString() : '-'}</dd>
              <dt>On chain</dt>
              <dd><code>{res.hash}</code></dd>
              <dt>This file</dt>
              <dd><code>{res.local}</code></dd>
            </dl>
            <a href={explorer(sig.trim())} target="_blank" rel="noreferrer">Solana Explorer</a>
          </div>
        )}
        {res && (res.kind === 'none' || res.kind === 'error') && <p className="error">{res.msg}</p>}
      </main>
    </div>
  );
}
