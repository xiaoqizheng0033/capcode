import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Download, Edit3, Check, X } from 'lucide-react'
import { api } from '../api'
import UpdateTimeline from '../components/UpdateTimeline'

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([api.getProject(id), api.getUpdates(id)])
      setProject(p)
      setUpdates(u)
      setDescDraft(p.description || p.auto_description || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function handlePull() {
    setPulling(true)
    try {
      await api.pullProject(id)
      await loadData()
    } catch (err) {
      alert('Pull 失败: ' + err.message)
    } finally {
      setPulling(false)
    }
  }

  async function handleSaveDesc() {
    try {
      const updated = await api.updateProject(id, descDraft)
      setProject(updated)
      setEditing(false)
    } catch (err) {
      alert('保存失败: ' + err.message)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-6"><p className="text-gray-400">加载中...</p></div>
  if (!project) return <div className="max-w-3xl mx-auto px-4 py-6"><p className="text-gray-400">项目未找到</p></div>

  const displayDesc = project.description || project.auto_description || '暂无介绍'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
        <div className="flex-1" />
        <button
          onClick={() => { setEditing(true); setDescDraft(project.description || project.auto_description || '') }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Edit3 size={14} /> 编辑
        </button>
      </div>

      {/* Project info */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">远程地址: </span>
            <a href={project.remote_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
              {project.remote_url} <ExternalLink size={12} />
            </a>
          </div>
          <div><span className="text-gray-400">本地路径: </span><span className="text-gray-700">{project.path}</span></div>
          <div><span className="text-gray-400">默认分支: </span><span className="text-gray-700">{project.default_branch}</span></div>
          <div><span className="text-gray-400">最近 commit: </span><span className="text-gray-700 font-mono text-xs">{project.last_commit_hash?.substring(0, 8) || '-'}</span></div>
        </div>

        <button
          onClick={handlePull}
          disabled={pulling}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Download size={16} /> {pulling ? 'Pull 中...' : '立即 Pull'}
        </button>
      </div>

      {/* Description */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">项目介绍</h2>
        {editing ? (
          <div>
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!project.description && project.auto_description && (
              <p className="text-xs text-gray-400 mt-1">自动提取自 README</p>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                <X size={14} /> 取消
              </button>
              <button onClick={handleSaveDesc} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <Check size={14} /> 保存
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{displayDesc}</p>
            {!project.description && project.auto_description && (
              <p className="text-xs text-gray-400 mt-1">自动提取自 README</p>
            )}
          </div>
        )}
      </div>

      {/* Update history */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-gray-900 mb-3">更新历史 ({updates.length})</h2>
        <UpdateTimeline updates={updates} />
      </div>
    </div>
  )
}
