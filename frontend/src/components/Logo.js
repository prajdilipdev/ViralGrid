// ViralGrid logomark: a content grid whose fourth tile "goes viral" —
// bursting into broadcast waves. Inherits color via currentColor.
export default function Logo({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ViralGrid logo"
    >
      <rect x="3" y="3" width="11" height="11" rx="3" fill="currentColor" />
      <rect x="3" y="18" width="11" height="11" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="18" y="18" width="11" height="11" rx="3" fill="currentColor" opacity="0.45" />
      <circle cx="19" cy="13" r="2" fill="currentColor" />
      <path d="M19 8 A5 5 0 0 1 24 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19 4.5 A8.5 8.5 0 0 1 27.5 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
