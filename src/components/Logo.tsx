// The mark: a sheet with a folded corner whose fold becomes a lark's wing,
// crossed by the scan line. Three colours so it still reads at 16px.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="pl-sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D5AFE" />
          <stop offset="1" stopColor="#1E2A78" />
        </linearGradient>
        <linearGradient id="pl-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB547" />
          <stop offset="1" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <path d="M14 6h24l14 14v34a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="url(#pl-sheet)" />
      <path d="M38 6c0 9 5 14 14 14H42a4 4 0 0 1-4-4z" fill="url(#pl-wing)" />
      <path d="M38 20c-6 6-14 8-22 6 6 6 15 6 22-1z" fill="url(#pl-wing)" opacity=".95" />
      <rect x="15" y="36" width="32" height="3" rx="1.5" fill="#7CF5D2" />
      <rect x="15" y="44" width="22" height="3" rx="1.5" fill="#fff" opacity=".55" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Pagelark</span>
    </span>
  );
}
