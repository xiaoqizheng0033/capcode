import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export default function CollapsibleSection({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{title}</span>
        {badge && <span className="text-xs text-gray-400 dark:text-gray-500">({badge})</span>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
