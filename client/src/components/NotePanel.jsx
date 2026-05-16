import { useState } from 'react'
import { Plus, Trash2, FileText, Edit3, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export default function NotePanel({ notes, learnTags, onDelete, onSave, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')

  function handleAdd() {
    if (!title.trim() || !content.trim()) return
    const tagArr = tags.split(',').map(s => s.trim()).filter(Boolean)
    onSave(title.trim(), content.trim(), tagArr)
    setTitle(''); setContent(''); setTags(''); setAdding(false)
  }

  function startEdit(note) {
    setEditing(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditTags((note.tags || []).join(', '))
  }

  function saveEdit() {
    if (!editTitle.trim()) return
    const tagArr = editTags.split(',').map(s => s.trim()).filter(Boolean)
    onUpdate(editing, { title: editTitle.trim(), content: editContent.trim(), tags: tagArr })
    setEditing(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">学习笔记</span>
        <button onClick={() => setAdding(!adding)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <Plus size={14} />
        </button>
      </div>

      {adding && (
        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="笔记标题" className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="笔记内容..." rows={3} className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="标签（逗号分隔）" className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
            <button onClick={handleAdd} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="p-3 text-xs text-gray-400">暂无笔记</p>
        ) : notes.map(n => {
          if (editing === n.id) {
            return (
              <div key={n.id} className="p-3 border-b border-gray-50 dark:border-gray-800">
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                  rows={4} className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)}
                  placeholder="标签（逗号分隔）" className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-gray-600"><X size={12} /></button>
                  <button onClick={saveEdit} className="text-xs text-blue-600 hover:text-blue-800"><Check size={12} /></button>
                </div>
              </div>
            )
          }
          return (
            <div key={n.id} className="px-3 py-2.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <FileText size={11} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{n.title}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{n.content?.substring(0, 300) || ''}</ReactMarkdown>
                  </div>
                  {(n.tags || []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {n.tags.map(t => <span key={t} className="px-1 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">{t}</span>)}
                    </div>
                  )}
                  {n.file_path && (
                    <span className="text-[10px] text-gray-400 mt-1 block font-mono truncate">{n.file_path}</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                  <button onClick={() => startEdit(n)} className="text-gray-400 hover:text-gray-600"><Edit3 size={11} /></button>
                  <button onClick={() => onDelete(n.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
