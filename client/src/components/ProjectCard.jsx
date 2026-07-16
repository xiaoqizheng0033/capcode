import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Trash2, AlertTriangle, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'
import StatusBadge from './StatusBadge'

function extractOverview(aiSummary) {
  if (!aiSummary) return ''
  const match = aiSummary.match(/###\s*项目概述\s*\n+([\s\S]*?)(?=\n###\s|\n##\s|$)/)
  if (match) return match[1].trim()
  return aiSummary.substring(0, 150)
}

export default function ProjectCard({ project, onDeleted, onUpdated }) {
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingPermanently, setDeletingPermanently] = useState(false)
  const [recloning, setRecloning] = useState(false)
  const overview = extractOverview(project.ai_summary)
  const desc = overview || project.description || project.auto_description || '暂无介绍'

  async function handleOpenFolder(e) {
    e.stopPropagation()
    if (opening) return
    setOpening(true)
    try {
      await api.openProjectFolder(project.id)
    } catch (err) {
      alert('打开目录失败: ' + err.message)
    } finally {
      setOpening(false)
    }
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (deleting) return
    const ok = window.confirm(
      `确定从 CapCode 中移除「${project.name}」吗？\n\n本地目录不会被删除，重新扫描后可能再次出现。`
    )
    if (!ok) return
    setDeleting(true)
    try {
      await api.deleteProject(project.id)
      onDeleted?.(project.id)
    } catch (err) {
      alert('删除失败: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleReclone(e) {
    e.stopPropagation()
    if (recloning) return
    if (!project.remote_url) {
      alert('该项目没有远程地址，无法重新克隆')
      return
    }
    const ok = window.confirm(
      `确定重新克隆「${project.name}」吗？\n\n将删除本地目录并重新 git clone：\n${project.path}\n\n本地未推送的修改将丢失！`
    )
    if (!ok) return
    setRecloning(true)
    try {
      const { project: updated } = await api.recloneProject(project.id)
      onUpdated?.(updated)
    } catch (err) {
      alert('重新克隆失败: ' + err.message)
    } finally {
      setRecloning(false)
    }
  }

  async function handlePermanentDelete(e) {
    e.stopPropagation()
    if (deletingPermanently) return
    const ok = window.confirm(
      `确定彻底删除「${project.name}」吗？\n\n将永久删除本地目录：\n${project.path}\n\n此操作不可恢复！`
    )
    if (!ok) return
    setDeletingPermanently(true)
    try {
      await api.deleteProjectPermanently(project.id)
      onDeleted?.(project.id)
    } catch (err) {
      alert('彻底删除失败: ' + err.message)
    } finally {
      setDeletingPermanently(false)
    }
  }

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() =>
        navigate(`/project/${project.id}`, { state: { listProject: project } })
      }
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate min-w-0">{project.name}</h3>
        <StatusBadge hasUpdates={project.has_updates} lastPullAt={project.last_pull_at} />
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 prose prose-sm max-w-none overflow-hidden [&_img]:hidden [&_h1]:hidden [&_h2]:hidden [&_h3]:hidden [&_p]:inline [&_p]:m-0 [&_*]:text-sm [&_*]:text-gray-500 dark:[&_*]:text-gray-400">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {desc}
        </ReactMarkdown>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{project.last_pull_at ? `上次 pull: ${new Date(project.last_pull_at).toLocaleString()}` : '未 pull'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={opening}
            title="打开项目目录"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <FolderOpen size={13} />
            <span>目录</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            title="从列表移除（保留本地目录）"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <Trash2 size={13} />
            <span>移除</span>
          </button>
          <button
            type="button"
            onClick={handleReclone}
            disabled={recloning}
            title="删除目录并重新 git clone"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={13} className={recloning ? 'animate-spin' : ''} />
            <span>{recloning ? '克隆中' : '重克隆'}</span>
          </button>
          <button
            type="button"
            onClick={handlePermanentDelete}
            disabled={deletingPermanently}
            title="彻底删除（删除本地目录）"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            <AlertTriangle size={13} />
            <span>彻底删</span>
          </button>
          <span>{project.default_branch}</span>
        </div>
      </div>
    </div>
  )
}
