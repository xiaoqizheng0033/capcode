export default function EagleLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Simple eagle head silhouette */}
      <path
        d="M6 24 L2 28 L4 26 L2 18 L6 14 L10 13 L14 10 L18 13 L22 14 L26 18 L28 26 L26 28 L22 24 L18 26 L14 26 L10 24 Z"
        className="fill-blue-600 dark:fill-blue-400"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* Eye */}
      <circle cx="16" cy="18" r="2" className="fill-amber-400" />
    </svg>
  )
}
