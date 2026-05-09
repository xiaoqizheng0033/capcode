import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import StatusBadge from './StatusBadge'

export default function ProjectCard({ project }) {
  const navigate = useNavigate()
  const desc = project.description || project.auto_description || '暂无介绍'

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => navigate(`/project/${project.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{project.name}</h3>
        <StatusBadge hasUpdates={project.has_updates} lastPullAt={project.last_pull_at} />
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 prose prose-sm max-w-none overflow-hidden [&_img]:hidden [&_h1]:hidden [&_h2]:hidden [&_h3]:hidden [&_p]:inline [&_p]:m-0 [&_*]:text-sm [&_*]:text-gray-500 dark:[&_*]:text-gray-400">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {desc}
        </ReactMarkdown>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{project.last_pull_at ? `上次 pull: ${new Date(project.last_pull_at).toLocaleString()}` : '未 pull'}</span>
        <span>{project.default_branch}</span>
      </div>
    </div>
  )
}
