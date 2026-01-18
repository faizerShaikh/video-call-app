export function SynchroLogo({ className = "w-8 h-8" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="synchroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      {/* Interwoven knot symbol - representing interconnected loops */}
      <path
        d="M30 40 Q20 50, 30 60 Q40 70, 50 65 Q60 70, 70 60 Q80 50, 70 40 Q60 30, 50 35 Q40 30, 30 40 Z"
        fill="url(#synchroGradient)"        
        opacity="0.9"
      />
      <path
        d="M35 45 Q45 50, 35 55 Q25 60, 35 65 Q45 60, 55 65 Q65 60, 55 55 Q45 50, 55 45 Q65 40, 55 35 Q45 40, 35 45 Z"
        fill="url(#synchroGradient)"
        opacity="0.8"
      />
      <path
        d="M40 50 Q50 45, 60 50 Q70 55, 60 60 Q50 55, 40 60 Q30 55, 40 50 Z"
        fill="url(#synchroGradient)"
        opacity="0.7"
      />
    </svg>
  );
}
