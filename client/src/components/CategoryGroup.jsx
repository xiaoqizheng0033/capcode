import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ProjectCard from './ProjectCard'

const categoryColors = {
  '量化交易': { bar: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400' },
  'AI Agent': { bar: 'border-l-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400' },
  '大模型应用': { bar: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400' },
  '开发工具': { bar: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400' },
  '数据分析': { bar: 'border-l-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/20', text: 'text-cyan-700 dark:text-cyan-400' },
  'Web框架': { bar: 'border-l-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-700 dark:text-pink-400' },
  '自动化工具': { bar: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400' },
  '教育学习': { bar: 'border-l-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-700 dark:text-teal-400' },
  '其他': { bar: 'border-l-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600 dark:text-gray-400' },
  '未分类': { bar: 'border-l-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/20', text: 'text-gray-500 dark:text-gray-400' },
}

function getColor(category) {
  return categoryColors[category] || categoryColors['其他']
}

export default function CategoryGroup({ category, projects, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = getColor(category)

  return (
    <div className="mb-5">
      <div className={`border-l-4 ${color.bar} rounded-r-lg ${color.bg} pl-3 pr-3 py-2 mb-2`}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
        >
          {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
          <span className={`font-semibold ${color.text}`}>{category}</span>
          <span className="text-sm text-gray-400 dark:text-gray-500">({projects.length})</span>
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
