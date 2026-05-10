export default function EagleLogo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="currentColor" className="text-blue-600 dark:text-blue-500" />

      {/* Eagle body outline */}
      <path
        d="M50 25 L30 50 L20 55 L30 52 L30 65 L30 75 L50 70 L70 75 L70 65 L70 52 L80 55 L70 50 Z"
        fill="#1e3a5f"
        stroke="#fbbf24"
        strokeWidth="1.5"
      />

      {/* Left wing - code symbol feathers */}
      <g transform="translate(28, 35) rotate(-25)">
        <text fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'{'}</text>
        <text x="8" y="2" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'}'}</text>
        <text x="5" y="12" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'<'}</text>
        <text x="14" y="14" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'/'}</text>
      </g>

      {/* Right wing - code symbol feathers */}
      <g transform="translate(58, 35) rotate(25)">
        <text fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'>'}</text>
        <text x="8" y="2" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'<'}</text>
        <text x="3" y="12" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'/'}</text>
        <text x="12" y="14" fontSize="9" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">{'>'}</text>
      </g>

      {/* Head */}
      <ellipse cx="50" cy="28" rx="10" ry="9" fill="#1e3a5f" stroke="#fbbf24" strokeWidth="1.2" />

      {/* Eyes with magnifying glass */}
      <circle cx="46" cy="27" r="2.5" fill="#fbbf24" />
      <circle cx="54" cy="27" r="2.5" fill="#fbbf24" />
      {/* Pupil + magnifier detail */}
      <circle cx="46.5" cy="26.5" r="1" fill="#1e3a5f" />
      <circle cx="54.5" cy="26.5" r="1" fill="#1e3a5f" />
      {/* Magnifier ring around right eye */}
      <circle cx="54" cy="27" r="4" stroke="#fbbf24" strokeWidth="0.8" fill="none" />
      <line x1="57" y1="30" x2="60" y2="33" stroke="#fbbf24" strokeWidth="0.8" />

      {/* Beak */}
      <polygon points="50,31 47,34 50,36 53,34" fill="#fbbf24" />

      {/* Talons holding Git branch icon */}
      <g transform="translate(38, 72)">
        <circle cx="5" cy="3" r="4" stroke="#fbbf24" strokeWidth="1" fill="none" />
        <circle cx="5" cy="3" r="1.5" fill="#fbbf24" />
        <line x1="5" y1="7" x2="5" y2="12" stroke="#fbbf24" strokeWidth="1" />
        <line x1="5" y1="10" x2="2" y2="13" stroke="#fbbf24" strokeWidth="0.8" />
        <line x1="5" y1="10" x2="8" y2="13" stroke="#fbbf24" strokeWidth="0.8" />
      </g>

      {/* Talons holding folder icon */}
      <g transform="translate(52, 72)">
        <rect x="0" y="0" width="10" height="8" rx="1" fill="#606f8b" stroke="#fbbf24" strokeWidth="0.5" />
        <rect x="0" y="0" width="5" height="2" rx="0.5" fill="#fbbf24" />
      </g>

      {/* Chest - AI sparkle */}
      <text x="42" y="55" fontSize="7" fill="#fbbf24" fontFamily="monospace">AI</text>
    </svg>
  )
}
