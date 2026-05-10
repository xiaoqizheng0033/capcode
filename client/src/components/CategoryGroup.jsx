import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ProjectCard from './ProjectCard'

export default function CategoryGroup({ category, projects, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-2 px-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
      >
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        <span className="font-semibold text-gray-700 dark:text-gray-300">{category}</span>
        <span className="text-sm text-gray-400 dark:text-gray-500">({projects.length})</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
