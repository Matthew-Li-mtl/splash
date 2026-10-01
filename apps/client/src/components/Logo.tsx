/** Two little houses, side by side. */
export function Logo({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 33 18.5 21 31 33v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#e07a5f" />
      <path d="M3.5 34.5 18.5 20l15 14.5" fill="none" stroke="#2d2620" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14.5" y="42" width="8" height="15" rx="2" fill="#2d2620" />
      <path d="M33 28 46 15l13 13v27a2 2 0 0 1-2 2H35a2 2 0 0 1-2-2Z" fill="#5f9e7c" />
      <path d="M30.5 30 46 14l15.5 16" fill="none" stroke="#2d2620" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="39" y="34" width="14" height="10" rx="2" fill="#fbf6ee" />
      <path d="M46 34v10M39 39h14" stroke="#5f9e7c" strokeWidth="2" />
    </svg>
  );
}
