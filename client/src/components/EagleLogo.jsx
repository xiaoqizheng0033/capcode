export default function EagleLogo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Eagle in flight - top-down silhouette */}
      {/* Outstretched wings */}
      <path
        d="M15 45 L50 35 L85 45 L82 28 L90 25 L78 22 L72 35 L50 28 L28 35 L22 22 L10 25 L18 28 Z"
        fill="#1e3a5f"
        stroke="#fbbf24"
        strokeWidth="1.2"
      />
      {/* Left wing code feathers */}
      <text x="12" y="38" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'{ }'}</text>
      {/* Right wing code feathers */}
      <text x="67" y="38" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'< />'}</text>

      {/* Broad tail feathers */}
      <path d="M30 48 L50 55 L70 48 L68 60 L50 65 L32 60 Z"
        fill="#1e3a5f" stroke="#fbbf24" strokeWidth="1"/>

      {/* Eagle head - proud profile facing right */}
      <path d="M50 22 L60 18 L68 22 Q72 24 68 28 L58 32 Q52 34 50 30 Z"
        fill="#1e3a5f" stroke="#fbbf24" strokeWidth="1.3"/>

      {/* Eye */}
      <circle cx="60" cy="23" r="2.2" fill="#fbbf24"/>
      <circle cx="60.5" cy="22.5" r="0.9" fill="#1e3a5f"/>

      {/* Magnifier around eye */}
      <circle cx="60" cy="23" r="4.2" stroke="#fbbf24" strokeWidth="0.8" fill="none"/>
      <line x1="63" y1="26" x2="66" y2="29" stroke="#fbbf24" strokeWidth="0.8"/>

      {/* Sharp hooked beak */}
      <path d="M68 24 L78 22 L74 27 L68 28 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5"/>

      {/* Talons holding git branch */}
      <g transform="translate(32, 60)">
        <circle cx="4" cy="2" r="4" stroke="#fbbf24" strokeWidth="0.8" fill="none"/>
        <circle cx="4" cy="2" r="1.2" fill="#fbbf24"/>
        <line x1="4" y1="6" x2="4" y2="11" stroke="#fbbf24" strokeWidth="0.8"/>
        <line x1="4" y1="9" x2="1" y2="12" stroke="#fbbf24" strokeWidth="0.7"/>
        <line x1="4" y1="9" x2="7" y2="12" stroke="#fbbf24" strokeWidth="0.7"/>
      </g>

      {/* Talons holding folder */}
      <g transform="translate(50, 60)">
        <rect x="0" y="0" width="10" height="8" rx="1" fill="#606f8b" stroke="#fbbf24" strokeWidth="0.6"/>
        <rect x="0" y="0" width="5" height="2" rx="0.5" fill="#fbbf24"/>
      </g>

      {/* AI Sparkle */}
      <text x="53" y="82" fontSize="7" fill="#fbbf24" fontFamily="monospace" fontWeight="bold">AI</text>
    </svg>
  )
}
