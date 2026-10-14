import Image from "next/image";

export function BrandMark({ className = "" }: { className?: string }) {
  return <Image src="/brand/logomark.svg" width={705} height={389} alt="" aria-hidden unoptimized className={className} />;
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return <Image src="/brand/logotype.svg" width={1010} height={160} alt="" aria-hidden unoptimized className={className} />;
}

export function SanFranciscoIllustration({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 500 360" fill="none" role="img" aria-label="An illustration of the Golden Gate Bridge and San Francisco hills" className={className}>
    <rect width="500" height="360" rx="18" fill="#f5f4f1" />
    <circle cx="355" cy="100" r="43" fill="#d6b879" />
    <circle cx="355" cy="100" r="62" stroke="#d6b879" strokeOpacity=".3" />
    <path d="M60 85h60m-30-8h66m259 65h45m-30-8h50" stroke="#d9d5ca" strokeWidth="2" strokeLinecap="round" />
    <path d="M0 225c56-50 92-23 149-42 69-24 108-8 158 17 63 32 119 11 193-28v188H0Z" fill="#e5e2da" />
    <path d="M0 290c61-25 94 18 152-1 89-30 169-6 224-15 42-6 85-28 124-33v119H0Z" fill="#d3cebf" />
    <path d="M20 315h460M40 331h420M60 347h380" stroke="#003C2E" strokeOpacity=".12" />
    <g stroke="#003C2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M45 247h410M137 246V132h18v114M345 246V132h18v114M134 154h24m184 0h24M134 172h24m184 0h24" />
      <path d="M45 213c51-8 91-45 101-78 20 54 51 77 105 78s88-31 103-78c17 40 52 67 101 78" />
      <path d="M68 208v39m23-50v50m23-66v66m64-61v61m25-44v44m25-36v36m25-33v33m25-36v36m25-48v48m24-65v65m61-64v64m24-47v47m24-38v38" strokeWidth="1.5" />
    </g>
  </svg>;
}
