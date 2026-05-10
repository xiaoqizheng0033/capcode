import { useTheme } from '../context/ThemeContext'

export default function CatLogo({ size = 32 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cat head - rounded silhouette */}
      <path
        d="M8 12 Q6 6 10 4 Q12 3 13 6 Q14 3 16 3 Q18 3 19 6 Q20 3 22 4 Q26 6 24 12
           L24 14 Q26 18 26 22 Q26 28 22 28 Q20 28 20 26 Q20 24 16 24 Q12 24 12 26
           Q12 28 10 28 Q6 28 6 22 Q6 18 8 14 Z"
        className={isDark ? 'fill-gray-200' : 'fill-gray-900'}
        stroke="currentColor"
        strokeWidth="0.3"
      />
      {/* Left ear inner */}
      <path d="M10.5 5 L11.5 4 L12 7 Q11 8 10.5 5 Z"
        className="fill-pink-400 dark:fill-pink-300" />
      {/* Right ear inner */}
      <path d="M20 7 L20.5 4 L21.5 5 Q21 8 20 7 Z"
        className="fill-pink-400 dark:fill-pink-300" />
      {/* Eyes - golden magnifier style */}
      <circle cx="13" cy="16" r="2" className="fill-amber-400" />
      <circle cx="19" cy="16" r="2" className="fill-amber-400" />
      {/* Pupils */}
      <circle cx="13.5" cy="15.5" r="0.8" className={isDark ? 'fill-gray-900' : 'fill-gray-800'} />
      <circle cx="19.5" cy="15.5" r="0.8" className={isDark ? 'fill-gray-900' : 'fill-gray-800'} />
      {/* Nose */}
      <path d="M15.5 19 L16 20 L16.5 19 Z" className="fill-pink-400 dark:fill-pink-300" />
      {/* Mouth */}
      <path d="M13 21 Q16 23 19 21" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.3" />
      {/* Whiskers */}
      <line x1="8" y1="18" x2="12" y2="19" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
      <line x1="8" y1="20" x2="12" y2="20" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
      <line x1="20" y1="19" x2="24" y2="18" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
      <line x1="20" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="0.25" opacity="0.3" />
      {/* Cap (hat) */}
      <path
        d="M9 11 Q10 6 16 6 Q22 6 23 11 L22 12 Q16 8 10 12 Z"
        className={isDark ? 'fill-amber-500' : 'fill-amber-600'}
        stroke="currentColor"
        strokeWidth="0.2"
      />
    </svg>
  )
}
