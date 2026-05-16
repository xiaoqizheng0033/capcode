import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Save, History, Plus, Trash2, FileText, CheckSquare, Square, StickyNote } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'

export default function LearnChat({ projectId, filePath, fileContent, compact, onSaveNote }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentChatId, setCurrentChatId] = useState(null)
  const [historyList, setHistoryList] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  // Selective save mode
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState({})
  const endRef = useRef(null)
  const chatFileRef = useRef(null)
  const autoSaveRef = useRef(null) // current chat ID for auto-save
  const inputRef = useRef(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = window.innerHeight * 0.33
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px'
  }, [input])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = window.innerHeight * 0.33
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px'
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Auto-save whenever messages change (debounced)
  useEffect(() => {
    const msgs = messages.filter(m => !m._system)
    if (msgs.length === 0) return
    const timer = setTimeout(async () => {
      try {
        const title = msgs.find(m => m.role === 'user')?.content?.substring(0, 50) || '对话记录'
        const result = await api.saveChatHistory(projectId, {
          id: autoSaveRef.current,
          title,
          filePath: filePath || '',
          messages: msgs,
        })
        autoSaveRef.current = result.id
        setCurrentChatId(result.id)
        loadHistoryList()
      } catch {}
    }, 1500)
    return () => clearTimeout(timer)
  }, [messages])

  useEffect(() => { loadHistoryList() }, [projectId])

  function loadHistoryList() {
    api.getChatHistory(projectId).then(setHistoryList).catch(() => {})
  }

  // When switching files, auto-save current then load new
  useEffect(() => {
    if (filePath && filePath !== chatFileRef.current) {
      chatFileRef.current = filePath
      // Try to load last saved conversation for this file
      api.getChatHistory(projectId).then(list => {
        const match = list.find(h => h.file_path === filePath)
        if (match) {
          api.loadChatHistory(projectId, match.id).then(data => {
            setMessages(data.messages)
            autoSaveRef.current = data.id
            setCurrentChatId(data.id)
          }).catch(() => { setMessages([]); autoSaveRef.current = null; setCurrentChatId(null) })
        } else {
          setMessages([])
          autoSaveRef.current = null
          setCurrentChatId(null)
        }
      }).catch(() => { setMessages([]); autoSaveRef.current = null; setCurrentChatId(null) })
    }
  }, [filePath])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages.filter(m => !m._system), userMsg]
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const data = await api.learnChat(projectId, newMessages, fileContent?.content, filePath)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `发送失败: ${err.message}` }])
    } finally { setSending(false) }
  }

  // Selective save: enter select mode, pick messages, save selection as new conversation
  function toggleSelectMode() {
    if (selectMode) { setSelectMode(false); setSelected({}); return }
    setSelectMode(true)
    setSelected({})
  }

  function toggleSelect(idx) {
    setSelected(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  async function saveSelected() {
    const picked = messages.filter((m, i) => !m._system && selected[i])
    if (picked.length === 0) return
    const title = picked.find(m => m.role === 'user')?.content?.substring(0, 50) || '摘录对话'
    try {
      await api.saveChatHistory(projectId, { id: null, title, filePath: filePath || '', messages: picked })
      loadHistoryList()
      setSelectMode(false)
      setSelected({})
    } catch (err) { alert('保存失败: ' + err.message) }
  }

  async function handleLoadHistory(chatId) {
    try {
      const data = await api.loadChatHistory(projectId, chatId)
      setMessages(data.messages)
      autoSaveRef.current = data.id
      setCurrentChatId(data.id)
      setShowHistory(false)
    } catch (err) { alert('加载失败: ' + err.message) }
  }

  function handleNewChat() {
    setMessages([])
    autoSaveRef.current = null
    setCurrentChatId(null)
    setShowHistory(false)
    setSelectMode(false)
    setSelected({})
  }

  async function handleDeleteHistory(chatId, e) {
    e.stopPropagation()
    if (!confirm('删除这条对话记录？')) return
    try {
      await api.deleteChatHistory(projectId, chatId)
      if (currentChatId === chatId) { setMessages([]); autoSaveRef.current = null; setCurrentChatId(null) }
      loadHistoryList()
    } catch (err) { alert('删除失败: ' + err.message) }
  }

  function handleSaveAsNote(msg) {
    if (onSaveNote) {
      const title = 'AI问答 · ' + new Date().toLocaleString()
      onSaveNote(title, msg.content)
    }
  }

  async function handleSaveAsCard(msg) {
    try {
      await api.createCard(projectId, { chatReply: msg.content, filePath: filePath || '' })
      alert('卡片已生成！')
    } catch (err) { alert('生成卡片失败: ' + err.message) }
  }

  const welcomeMsg = filePath
    ? { role: 'assistant', content: `当前文件：**${filePath}** (${fileContent?.lines || 0} 行)\n\n你可以向我提问来学习这个文件的内容。`, _system: true }
    : { role: 'assistant', content: `你正在学习这个项目，选中文件后可以针对具体代码提问。\n\n也可以直接问我关于项目架构、技术选型等问题。`, _system: true }

  if (showHistory) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500">对话历史</span>
          <button onClick={() => setShowHistory(false)} className="text-xs text-gray-400 hover:text-gray-600">返回</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {historyList.length === 0 ? (
            <p className="p-3 text-xs text-gray-400">暂无历史对话</p>
          ) : historyList.map(h => (
            <div key={h.id} onClick={() => handleLoadHistory(h.id)}
              className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{h.title}</span>
                <button onClick={(e) => handleDeleteHistory(h.id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {new Date(h.updated_at).toLocaleString()}
                {h.file_path ? ' · ' + h.file_path.split('/').pop() : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <button onClick={handleNewChat} className="p-1 text-gray-400 hover:text-gray-600" title="新对话"><Plus size={14} /></button>
        <button onClick={() => setShowHistory(true)} className="p-1 text-gray-400 hover:text-gray-600" title="历史"><History size={14} /></button>
        <button onClick={toggleSelectMode} className={`p-1 ${selectMode ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="选取保存"><Save size={14} /></button>
        {selectMode && Object.values(selected).some(Boolean) && (
          <button onClick={saveSelected} className="text-[10px] text-blue-600 hover:underline ml-1">保存选中({Object.values(selected).filter(Boolean).length})</button>
        )}
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto ${compact ? 'p-2 space-y-2' : 'p-4 space-y-4'}`}>
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className={`rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 ${compact ? 'max-w-[95%] px-3 py-2' : 'max-w-[85%] px-4 py-2.5'}`}>
              <div className={`markdown-body ${compact ? 'text-xs' : 'text-sm'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{welcomeMsg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          if (m._system) return null
          return (
            <div key={i} className={`flex group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* Checkbox in select mode */}
              {selectMode && (
                <button onClick={() => toggleSelect(i)}
                  className="flex-shrink-0 self-center mr-1 text-gray-400 hover:text-blue-600">
                  {selected[i] ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                </button>
              )}
              <div className={`rounded-lg ${compact ? 'max-w-[95%] px-3 py-1.5' : 'max-w-[85%] px-4 py-2.5'} ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}>
                {m.role === 'user' ? (
                  <p className={`whitespace-pre-wrap break-words ${compact ? 'text-xs' : 'text-sm'}`}>{m.content}</p>
                ) : (
                  <div>
                    <div className={`markdown-body break-words ${compact ? 'text-xs' : 'text-sm'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{m.content}</ReactMarkdown>
                    </div>
                    {onSaveNote && !selectMode && (
                      <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleSaveAsNote(m)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500">
                        <FileText size={10} /> 生成笔记
                      </button>
                      <button onClick={() => handleSaveAsCard(m)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-green-500">
                        <StickyNote size={10} /> 生成卡片
                      </button>
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-400 pl-4">
            <Loader2 size={14} className="animate-spin" /> AI 回复中...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className={`flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex items-end gap-2 ${compact ? 'p-2' : 'p-3'}`}>
        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="向 AI 提问... (Enter 发送，Shift+Enter 换行)"
          disabled={sending}
          rows={1}
          style={{ maxHeight: '33vh' }}
          className={`flex-1 resize-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${compact ? 'text-xs px-2 py-1.5' : 'text-sm px-3 py-2'}`} />
        <button onClick={handleSend} disabled={sending || !input.trim()}
          className={`flex-shrink-0 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
          <Send size={compact ? 14 : 16} />
        </button>
      </div>
    </div>
  )
}
