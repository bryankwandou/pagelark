import { useT, type Lang } from '../lib/i18n';
import { Icon } from './Icon';

export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useT();
  return (
    <label className={`lang ${compact ? 'compact' : ''}`}>
      <Icon name="globe" size={18} />
      {!compact && <span className="sr">{t.language}</span>}
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t.language}>
        <option value="en">English</option>
        <option value="id">Bahasa Indonesia</option>
      </select>
    </label>
  );
}
