export function BrandMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden className={className}>
    <path d="M9 30V15a9 9 0 0 1 18 0v15M15 30V15a3 3 0 0 1 6 0v15" stroke="currentColor" strokeWidth="2.5" />
    <path d="M4 30h28M18 5V1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function SanFranciscoIllustration({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 500 360" fill="none" role="img" aria-label="An illustration of the Golden Gate Bridge and San Francisco hills" className={className}>
    <defs><pattern id="sf-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0v30" stroke="#ffffff" strokeOpacity=".05" /></pattern></defs>
    <rect width="500" height="360" rx="24" fill="#041f14" />
    <rect width="500" height="360" rx="24" fill="url(#sf-grid)" />
    <circle cx="355" cy="100" r="47" fill="#d4a844" />
    <circle cx="355" cy="100" r="65" stroke="#d4a844" strokeOpacity=".2" />
    <path d="M0 225c56-50 92-23 149-42 69-24 108-8 158 17 63 32 119 11 193-28v188H0Z" fill="#133a2a" />
    <path d="M0 290c61-25 94 18 152-1 89-30 169-6 224-15 42-6 85-28 124-33v119H0Z" fill="#1d4935" />
    <path d="M0 315h500M20 331h460M40 347h420" stroke="#e7d9b3" strokeOpacity=".14" />
    <g stroke="#ead5a3" strokeWidth="3"><path d="M45 247h410M137 246V132h18v114M345 246V132h18v114M134 154h24m184 0h24M134 172h24m184 0h24" />
      <path d="M45 213c51-8 91-45 101-78 20 54 51 77 105 78s88-31 103-78c17 40 52 67 101 78" />
      <path d="M68 208v39m23-50v50m23-66v66m64-61v61m25-44v44m25-36v36m25-33v33m25-36v36m25-48v48m24-65v65m61-64v64m24-47v47m24-38v38" strokeWidth="1.5" />
    </g>
    <path d="m51 51 8-8m-8 0 8 8" stroke="#d4a844" strokeWidth="1.5" />
    <path d="M51 70h60" stroke="#d4a844" strokeOpacity=".5" />
    <text x="49" y="92" fill="#d7e0d6" fontSize="10" letterSpacing="2.5" fontFamily="sans-serif">THE NEXT CHAPTER</text>
    <text x="49" y="115" fill="#ffffff" fontSize="16" fontFamily="sans-serif">San Francisco, California</text>
    <text x="49" y="335" fill="#d7e0d6" fontSize="9" letterSpacing="2" fontFamily="monospace">37.7749° N / 122.4194° W</text>
  </svg>;
}
