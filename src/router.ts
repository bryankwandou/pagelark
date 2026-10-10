import { useEffect, useState } from 'react';

// Hash routing keeps the app working as a static Vercel deploy and inside an
// APK webview without server rewrites.
export const go = (path: string) => {
  location.hash = '#' + path;
};

export function useRoute() {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
