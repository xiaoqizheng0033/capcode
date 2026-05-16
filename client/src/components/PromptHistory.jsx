import { useState, useEffect } from 'react'
import { useRef } from 'react'
import { Trash2, Edit3, Check, X, Star, Copy, Image } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'

export default function PromptHistory({ projectId }) {
  const [history, setHistory] = useState([])
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [viewAll, setViewAll] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [listWidth, setListWidth] = useState(320)
  const [dragging, setDragging] = useState(false)
  const [editContent, setEditContent] = useState(false)
  const fileInputRef = useRef(null)

  async function handleUploadImage() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    try {
      const result = await api.uploadPromptImage(projectId, selected.id, file)
      // Update selected's images locally
      setSelected(prev => ({ ...prev, images: result.images }))
      loadHistory()
    } catch (err) { alert('上传失败: ' + err.message) }
  }

  useEffect(() => { loadHistory() }, [projectId, filterStarred, filterTag, viewAll, filterProject])

  function loadHistory() {
    const opts = { starred: filterStarred, tag: filterTag }
    if (viewAll) opts.all = true
    if (filterProject) opts.project = filterProject
    api.getPromptHistory(projectId, opts).then(setHistory).catch(() => setHistory([]))
  }

  function startEdit(h) {
    setEditing(h.id)
    setEditForm({ title: h.title || '', tags: (h.tags || []).join(', '), prompt: h.prompt || '' })
  }

  async function saveEdit() {
    const tagArr = (editForm.tags || '').split(',').map(s => s.trim()).filter(Boolean)
    await api.updatePromptHistory(projectId, editing, { title: editForm.title, tags: tagArr, prompt: editForm.prompt })
    setEditing(null)
    setEditContent(false)
    loadHistory()
    // Update selected display
    setSelected(prev => prev?.id === editing ? { ...prev, title: editForm.title, tags: tagArr, prompt: editForm.prompt } : prev)
  }

  async function toggleStar(h) {
    await api.updatePromptHistory(projectId, h.id, { starred: !h.starred })
    loadHistory()
  }

  async function handleDelete(hId) {
    if (!confirm('删除这条记录？')) return
    await api.deletePromptHistory(projectId, hId)
    if (selected?.id === hId) setSelected(null)
    loadHistory()
  }

  // Drag resize
  function onListMouseDown(e) {
    e.preventDefault()
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    function onMove(e) { setListWidth(Math.min(600, Math.max(200, e.clientX))) }
    function onUp() { setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col" style={{ width: listWidth }}>
        {/* Filter bar */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1 mb-1.5">
            <button onClick={() => setViewAll(!viewAll)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${viewAll ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
              {viewAll ? '全部项目' : '当前项目'}
            </button>
            <button onClick={() => setFilterStarred(!filterStarred)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${filterStarred ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
              <Star size={10} /> 收藏
            </button>
            <input type="text" value={filterTag} onChange={e => setFilterTag(e.target.value)}
              placeholder="标签筛选" className="flex-1 text-[10px] border rounded px-2 py-0.5 bg-white dark:bg-gray-800" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">暂无历史记录</p>
        ) : history.map(h => (
          <div key={h.id} onClick={() => setSelected(h)}
            className={`px-3 py-2 border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected?.id === h.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{h.title || h.prompt?.substring(0, 60)}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleStar(h) }}
                className={h.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}>
                <Star size={11} fill={h.starred ? 'currentColor' : 'none'} />
              </button>
            </div>
            {/* Strip markdown markers for preview */}
            <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
              {h.prompt?.replace(/^#{1,3}\s+/gm, '').substring(0, 120)}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {h.project_name && viewAll && (
                <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded px-1 truncate max-w-[120px]">{h.project_name}</span>
              )}
              {h.tags?.length > 0 && h.tags.map(t => <span key={t} className="px-1 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">{t}</span>)}
              <span className="text-[10px] text-gray-400">{h.items_count} 条 · {new Date(h.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={onListMouseDown}
        className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <div className="max-w-4xl">
            {/* Title bar */}
            <div className="flex items-center justify-between mb-4">
              {editContent ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                    className="flex-1 text-sm font-semibold border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                  <input type="text" value={editForm.tags} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="标签" className="w-32 text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                  <button onClick={saveEdit} className="px-2 py-1 text-xs bg-blue-600 text-white rounded"><Check size={12} /></button>
                  <button onClick={() => { setEditing(null); setEditContent(false) }} className="text-xs text-gray-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selected.title || '未命名'}</h2>
                  <div className="flex items-center gap-1">
                    <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleUploadImage} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-gray-400 hover:text-blue-500"><Image size={12} /></button>
                    <button onClick={() => { startEdit(selected); setEditContent(true) }}
                      className="text-xs text-gray-400 hover:text-gray-600"><Edit3 size={12} /></button>
                    <button onClick={() => handleDelete(selected.id)}
                      className="text-xs text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    <button onClick={() => { navigator.clipboard.writeText(selected.prompt || ''); alert('已复制') }}
                      className="text-xs text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                  </div>
                </>
              )}
            </div>
            {/* Tags */}
            {selected.tags?.length > 0 && (
              <div className="flex gap-1 mb-3 flex-wrap">
                {selected.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">{t}</span>)}
              </div>
            )}
            {/* Prompt content */}
            {editContent ? (
              <textarea value={editForm.prompt} onChange={e => setEditForm(p => ({ ...p, prompt: e.target.value }))}
                rows={Math.max(10, (editForm.prompt || '').split('\n').length + 2)}
                className="w-full text-sm border rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono resize-none" />
            ) : (
              <div className="markdown-body text-sm text-gray-700 dark:text-gray-300" onDoubleClick={() => { startEdit(selected); setEditContent(true) }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{selected.prompt || ''}</ReactMarkdown>
              </div>
            )}
            {/* Images */}
            {selected.images?.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {selected.images.map((url, i) => (
                  <img key={i} src={url} alt={url} className="max-w-[300px] max-h-[200px] rounded border border-gray-200 dark:border-gray-700 object-contain" />
                ))}
              </div>
            )}
            <div className="mt-4 text-[10px] text-gray-400 flex items-center gap-2">
              {selected.project_name && <span className="text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded px-1">{selected.project_name}</span>}
              {selected.items_count} 条条目 · {new Date(selected.created_at).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">选择一条记录查看</div>
        )}
      </div>
    </div>
  )
}
