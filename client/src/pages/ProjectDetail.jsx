import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Download, Edit3, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'
import UpdateTimeline from '../components/UpdateTimeline'
import CollapsibleSection from '../components/CollapsibleSection'

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [logs, setLogs] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const loadData = useCallback(async () => {
    try {
      const [p, u, cats] = await Promise.all([
        api.getProject(id),
        api.getUpdates(id),
        api.getCategories().catch(() => []),
      ])
      setProject(p)
      setUpdates(u)
      setCategories(cats)
      setDescDraft(p.description || p.auto_description || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // Reload data when navigating back to this page
  useEffect(() => {
    const onFocus = () => loadData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadData])

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
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400 dark:text-gray-500">远程地址: </span>
            <a href={project.remote_url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              {project.remote_url} <ExternalLink size={12} />
            </a>
          </div>
          <div><span className="text-gray-400 dark:text-gray-500">本地路径: </span><span className="text-gray-700 dark:text-gray-300">{project.path}</span></div>
          <div><span className="text-gray-400 dark:text-gray-500">默认分支: </span><span className="text-gray-700 dark:text-gray-300">{project.default_branch}</span></div>
          <div><span className="text-gray-400 dark:text-gray-500">最近 commit: </span><span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{project.last_commit_hash?.substring(0, 8) || '-'}</span></div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <span className="text-sm text-gray-400 dark:text-gray-500">分类:</span>
          <select
            value={project.category || ''}
            onChange={async (e) => {
              try {
                const updated = await api.updateCategory(id, e.target.value)
                setProject(updated)
              } catch (err) {
                alert('分类更新失败: ' + err.message)
              }
            }}
            className="text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">未分类</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
            {project.category && !categories.includes(project.category) && (
              <option value={project.category}>{project.category}</option>
            )}
          </select>
        </div>

        <button
          onClick={handlePull}
          disabled={pulling}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Download size={16} /> {pulling ? '拉取中...' : '立即拉取'}
        </button>

        {/* Terminal-style pull log */}
        {logs.length > 0 && (
          <div className="mt-3 bg-gray-950 text-green-400 rounded-md p-3 font-mono text-xs max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-300' : 'text-green-400'}>
                {log.type === 'info' && '> '}{log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </CollapsibleSection>

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
        <UpdateTimeline updates={updates} />
      </CollapsibleSection>
    </div>
  )
}
