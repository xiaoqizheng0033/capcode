import { useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'

export default function ProjectCard({ project }) {
  const navigate = useNavigate()
  const desc = project.description || project.auto_description || '暂无介绍'

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
        <StatusBadge hasUpdates={project.has_updates} lastPullAt={project.last_pull_at} />
      </div>
      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{desc}</p>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{project.last_pull_at ? `上次 pull: ${new Date(project.last_pull_at).toLocaleString()}` : '未 pull'}</span>
        <span>{project.default_branch}</span>
      </div>
    </div>
  )
}
