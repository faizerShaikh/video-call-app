export function SynchroMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 38 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="13" cy="16" r="10.5" stroke="#0F2A44" strokeWidth="2.5" />
      <circle cx="25" cy="16" r="10.5" stroke="#1C6E6E" strokeWidth="2.5" />
    </svg>
  );
}

export function SynchroLogo({ className = '', wordClassName = '' }) {
  return (
    <span className={`inline-flex items-center gap-[0.42em] font-bold leading-none tracking-[-0.03em] text-[#0F2A44] ${className}`}>
      <SynchroMark className="h-[1.45em] w-auto shrink-0" />
      <span className={wordClassName}>Synchro</span>
    </span>
  );
}
