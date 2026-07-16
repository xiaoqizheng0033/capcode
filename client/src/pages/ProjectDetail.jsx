import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Download, Edit3, Check, X, FileText, ChevronRight, GraduationCap, FolderOpen, Trash2, AlertTriangle, RefreshCw, Play } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'
import UpdateTimeline from '../components/UpdateTimeline'
import CollapsibleSection from '../components/CollapsibleSection'


function mergeListSummary(apiProject, listRow, routeId) {
  if (!listRow || String(listRow.id) !== String(routeId)) return apiProject
  const fromApi = (apiProject.ai_summary ?? '').trim()
  const fromList = (listRow.ai_summary ?? '').trim()
  if (!fromList || fromApi) return apiProject
  return { ...apiProject, ai_summary: listRow.ai_summary }
}

export default function ProjectDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [logs, setLogs] = useState([])
  const [allTags, setAllTags] = useState([])
  const [tagsInput, setTagsInput] = useState('')
  const [tagsEditing, setTagsEditing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingPermanently, setDeletingPermanently] = useState(false)
  const [recloning, setRecloning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [release, setRelease] = useState(undefined) // undefined = loading, null = no release
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const loadData = useCallback(async (signal) => {
    try {
      const opts = signal ? { signal } : {}
      const [p, u, cats] = await Promise.all([
        api.getProject(id, opts),
        api.getUpdates(id, opts),
        api.getTags(opts).catch((err) => {
          if (err.name === 'AbortError') throw err
          return []
        }),
      ])
      // Load release separately — don't block page render on GitHub API
      api.getProjectRelease(id).then(setRelease).catch(() => {})
      const merged = mergeListSummary(p, location.state?.listProject, id)
      setProject(merged)
      setUpdates(u)
      setAllTags(cats)
      setDescDraft(merged.description || merged.auto_description || '')
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id, location.state?.listProject])

  // Reload on mount AND every route navigation to this page
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData, location.key])
  async function handlePull() {
    setPulling(true)
    setLogs([])
    try {
      const res = await fetch(`/api/projects/${id}/pull`, { method: 'POST' })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          let eventType = ''
          let eventData = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7)
            else if (line.startsWith('data: ')) eventData = line.slice(6)
          }
          if (!eventType || !eventData) continue
          try {
            const data = JSON.parse(eventData)
            if (eventType === 'progress') {
              const progressLines = data.message.split('\n').filter(l => l.trim())
              setLogs(prev => {
                const next = [...prev]
                for (const line of progressLines) {
                  const text = line.trimEnd()
                  const isFetching = text.startsWith('remote: Compressing') || text.startsWith('remote: Counting') || text.startsWith('remote: Enumerating')
                  const isUnpacking = text.startsWith('Unpacking') || text.startsWith('Resolving deltas')
                  if (isFetching || isUnpacking) {
                    const key = text.split(':')[0]
                    const lastIdx = next.length - 1
                    if (lastIdx >= 0 && next[lastIdx]._key === key) {
                      next[lastIdx] = { type: 'info', text, _key: key }
                    } else {
                      next.push({ type: 'info', text, _key: key })
                    }
                  } else {
                    next.push({ type: 'info', text })
                  }
                }
                return next
              })
            } else if (eventType === 'done') {
              setLogs(prev => [...prev, { type: 'success', text: data.result.status === 'no_change' ? '已是最新' : `拉取完成，${data.result.commitsCount} 个新提交` }])
              setPulling(false)
              loadData()
            } else if (eventType === 'error') {
              setLogs(prev => [...prev, { type: 'error', text: data.message }])
              setPulling(false)
            }
          } catch {}
        }
      }
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', text: err.message }])
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

  async function handleStartProject() {
    if (starting) return
    setStarting(true)
    try {
      await api.runStartBat(id)
    } catch (err) {
      alert('启动失败: ' + err.message)
    } finally {
      setStarting(false)
    }
  }

  async function handleOpenFolder() {
    if (openingFolder) return
    setOpeningFolder(true)
    try {
      await api.openProjectFolder(id)
    } catch (err) {
      alert('打开目录失败: ' + err.message)
    } finally {
      setOpeningFolder(false)
    }
  }

  async function handleReclone() {
    if (recloning) return
    if (!project?.remote_url) {
      alert('该项目没有远程地址，无法重新克隆')
      return
    }
    const ok = window.confirm(
      `确定重新克隆「${project.name}」吗？\n\n将删除本地目录并重新 git clone：\n${project.path}\n\n本地未推送的修改将丢失！`
    )
    if (!ok) return
    setRecloning(true)
    setLogs([])
    try {
      const { project: updated } = await api.recloneProject(id, (message) => {
        const progressLines = message.split('\n').filter(l => l.trim())
        setLogs(prev => {
          const next = [...prev]
          for (const line of progressLines) {
            const text = line.trimEnd()
            const isReceiving = text.startsWith('Receiving objects:')
            const isResolving = text.startsWith('Resolving deltas:')
            const isCompressing = text.startsWith('remote: Compressing')
            if (isReceiving || isResolving || isCompressing) {
              const key = isReceiving ? 'Receiving' : isResolving ? 'Resolving' : 'remoteCompress'
              const lastIdx = next.length - 1
              if (lastIdx >= 0 && next[lastIdx]._key === key) {
                next[lastIdx] = { type: 'info', text, _key: key }
              } else {
                next.push({ type: 'info', text, _key: key })
              }
            } else {
              next.push({ type: 'info', text })
            }
          }
          return next
        })
      })
      setLogs(prev => [...prev, { type: 'success', text: '重新克隆完成' }])
      setProject(updated)
      setDescDraft(updated.description || updated.auto_description || '')
      setRelease(undefined)
      api.getProjectRelease(id).then(setRelease).catch(() => setRelease(null))
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', text: err.message }])
    } finally {
      setRecloning(false)
    }
  }

  async function handleDelete() {
    if (deleting) return
    const ok = window.confirm(
      `确定从 CapCode 中移除「${project?.name || '该项目'}」吗？\n\n本地目录不会被删除，重新扫描后可能再次出现。`
    )
    if (!ok) return
    setDeleting(true)
    try {
      await api.deleteProject(id)
      navigate('/')
    } catch (err) {
      alert('删除失败: ' + err.message)
      setDeleting(false)
    }
  }

  async function handlePermanentDelete() {
    if (deletingPermanently) return
    const ok = window.confirm(
      `确定彻底删除「${project?.name || '该项目'}」吗？\n\n将永久删除本地目录：\n${project?.path || ''}\n\n此操作不可恢复！`
    )
    if (!ok) return
    setDeletingPermanently(true)
    try {
      await api.deleteProjectPermanently(id)
      navigate('/')
    } catch (err) {
      alert('彻底删除失败: ' + err.message)
      setDeletingPermanently(false)
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-6"><p className="text-gray-400 dark:text-gray-500">加载中...</p></div>
  if (!project) return <div className="max-w-3xl mx-auto px-4 py-6"><p className="text-gray-400 dark:text-gray-500">项目未找到</p></div>

  const displayDesc = project.description || project.auto_description || '暂无介绍'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
        <div className="flex-1" />
        <button
          onClick={() => { setEditing(true); setDescDraft(project.description || project.auto_description || '') }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Edit3 size={14} /> 编辑
        </button>
      </div>

      {/* Project info - always open */}
      <CollapsibleSection title="基本信息" defaultOpen={true}>
        {/* Remote URL — full width */}
        <div className="text-sm">
          <span className="text-gray-400 dark:text-gray-500">远程地址</span>
          <a href={project.remote_url} target="_blank" rel="noreferrer" className="ml-3 text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            {project.remote_url} <ExternalLink size={12} />
          </a>
        </div>

        {/* Meta info row — compact */}
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-400 dark:text-gray-500">开发者 <span className="text-gray-700 dark:text-gray-300">{project.author || '-'}</span></span>
          <span className="text-gray-400 dark:text-gray-500">分支 <span className="text-gray-700 dark:text-gray-300">{project.default_branch}</span></span>
          <span className="text-gray-400 dark:text-gray-500">路径 <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{project.path}</span></span>
          <span className="text-gray-400 dark:text-gray-500">commit <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{project.last_commit_hash?.substring(0, 8) || '-'}</span></span>
        </div>

        {/* Tags row */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">标签</span>
          <div className="flex flex-wrap gap-1">
            {(JSON.parse(project.tags || '[]')).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                {tag}
                <button
                  onClick={async () => {
                    const tags = JSON.parse(project.tags || '[]').filter(t => t !== tag)
                    const updated = await api.updateTags(id, tags)
                    setProject(updated)
                  }}
                  className="hover:text-blue-900 dark:hover:text-blue-200"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setTagsEditing(!tagsEditing)}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400"
            >
              + 添加标签
            </button>
          </div>
        </div>
        {tagsEditing && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="输入标签名..."
              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && tagsInput.trim()) {
                  const tags = [...new Set([...JSON.parse(project.tags || '[]'), tagsInput.trim()])]
                  const updated = await api.updateTags(id, tags)
                  setProject(updated)
                  setTagsInput('')
                }
              }}
            />
            <button
              onClick={async () => {
                if (!tagsInput.trim()) return
                const tags = [...new Set([...JSON.parse(project.tags || '[]'), tagsInput.trim()])]
                const updated = await api.updateTags(id, tags)
                setProject(updated)
                setTagsInput('')
              }}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              添加
            </button>
            <button onClick={() => setTagsEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        )}
        {tagsEditing && allTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {allTags.filter(t => !(JSON.parse(project.tags || '[]')).includes(t.name)).map(t => (
              <button
                key={t.name}
                onClick={async () => {
                  const tags = [...new Set([...JSON.parse(project.tags || '[]'), t.name])]
                  const updated = await api.updateTags(id, tags)
                  setProject(updated)
                }}
                className="px-2 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Actions — outside basic info */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={handlePull}
          disabled={pulling}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Download size={16} /> {pulling ? '拉取中...' : '立即拉取'}
        </button>
        <button
          onClick={async () => {
            setSummarizing(true)
            try {
              const updated = await api.regenerateSummary(id)
              setProject(updated)
            } catch (err) {
              alert('摘要生成失败: ' + err.message)
            } finally {
              setSummarizing(false)
            }
          }}
          disabled={!!project.ai_summary || summarizing}
          title={project.ai_summary ? '摘要已存在' : '生成 AI 摘要'}
          className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed enabled:bg-blue-600 enabled:hover:bg-blue-700"
        >
          <FileText size={16} /> {summarizing ? '生成中...' : project.ai_summary ? '已生成摘要' : '生成摘要'}
        </button>
        <Link
          to={`/project/${id}/learn`}
          className="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          <GraduationCap size={16} /> 学习工作室
        </Link>
        <button
          onClick={handleOpenFolder}
          disabled={openingFolder}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <FolderOpen size={16} /> {openingFolder ? '打开中...' : '打开目录'}
        </button>
        {project.has_start_bat && (
          <button
            onClick={handleStartProject}
            disabled={starting}
            title={`运行 ${project.start_bat_path || 'start.bat'}`}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            <Play size={16} /> {starting ? '启动中...' : '一键启动'}
          </button>
        )}
        <button
          onClick={handleReclone}
          disabled={recloning || !project.remote_url}
          title={project.remote_url ? '删除本地目录并重新 git clone' : '无远程地址'}
          className="flex items-center gap-2 px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-sm rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
        >
          <RefreshCw size={16} className={recloning ? 'animate-spin' : ''} />
          {recloning ? '克隆中...' : '重新克隆'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="从列表移除，保留本地目录"
          className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
        >
          <Trash2 size={16} /> {deleting ? '移除中...' : '移除'}
        </button>
        <button
          onClick={handlePermanentDelete}
          disabled={deletingPermanently}
          title="删除本地目录及所有项目数据"
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          <AlertTriangle size={16} /> {deletingPermanently ? '删除中...' : '彻底删除'}
        </button>
      </div>

      {/* Terminal-style pull log */}
      {logs.length > 0 && (
        <div className="mb-6 bg-gray-950 text-green-400 rounded-md p-3 font-mono text-xs max-h-48 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-300' : 'text-green-400'}>
              {log.type === 'info' && '> '}{log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* AI Summary - collapsed if long */}
      {project.ai_summary && (
        <CollapsibleSection title="AI 摘要" defaultOpen={false}>
          <div className="flex justify-end mb-2">
            <button
              onClick={async () => {
                try {
                  const updated = await api.regenerateSummary(id)
                  setProject(updated)
                } catch (err) {
                  alert('重新生成失败: ' + err.message)
                }
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              重新生成
            </button>
          </div>
          <div className="markdown-body text-sm text-gray-700 dark:text-gray-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {project.ai_summary}
            </ReactMarkdown>
          </div>
        </CollapsibleSection>
      )}

      {/* Description */}
      <CollapsibleSection title="项目介绍" badge={project.readme_content ? 'README' : null} defaultOpen={false}>
        {editing ? (
          <div>
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!project.description && project.auto_description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">自动提取自 README</p>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                <X size={14} /> 取消
              </button>
              <button onClick={handleSaveDesc} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <Check size={14} /> 保存
              </button>
            </div>
          </div>
        ) : (
          <div>
            {project.readme_content ? (
              <div className="markdown-body text-sm text-gray-700 dark:text-gray-300 max-h-[600px] overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md p-4 bg-gray-50/50 dark:bg-gray-800/50">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {project.readme_content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{displayDesc}</p>
            )}
            {!project.description && project.auto_description && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">自动提取自 README</p>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Update history */}
      <CollapsibleSection title="更新历史" badge={updates.length} defaultOpen={false}>
        <UpdateTimeline
          updates={updates}
          release={release}
          onDelete={async (updateId) => {
            await api.deleteUpdate(id, updateId)
            setUpdates(prev => prev.filter(u => u.id !== updateId))
          }}
        />
      </CollapsibleSection>
    </div>
  )
}
