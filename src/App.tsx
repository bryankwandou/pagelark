import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { LangCtx, dicts, initialLang, type Lang } from './lib/i18n';
import { useRoute } from './router';
import { Landing } from './screens/Landing';
import { Home } from './screens/Home';
const Camera = lazy(() => import('./screens/Camera').then((m) => ({ default: m.Camera })));
const DocView = lazy(() => import('./screens/DocView').then((m) => ({ default: m.DocView })));
const Verify = lazy(() => import('./screens/Verify').then((m) => ({ default: m.Verify })));

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('pl-lang', l);
    } catch {
      /* storage blocked */
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const ctx = useMemo(() => ({ t: dicts[lang], lang, setLang }), [lang]);

  const route = useRoute();
  const [path, query] = route.split('?');
  const params = new URLSearchParams(query ?? '');

  let screen: React.ReactNode;
  if (path === '/app') screen = <Home tab="home" />;
  else if (path === '/files') screen = <Home tab="files" />;
  else if (path === '/scan') screen = <Camera key={route} addTo={params.get('add') ?? undefined} />;
  else if (path.startsWith('/doc/')) screen = <DocView key={path} id={path.slice(5)} initialTab={params.get('tab') ?? undefined} />;
  else if (path === '/verify') screen = <Verify sig={params.get('sig') ?? undefined} />;
  else screen = <Landing />;

  return (
    <LangCtx.Provider value={ctx}>
      <Suspense fallback={<div className="screen center"><span className="spinner" /></div>}>{screen}</Suspense>
    </LangCtx.Provider>
  );
}
