import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Code, MessageSquare, StickyNote, PanelRightClose, PanelRight, PanelLeftClose, PanelLeft, Loader2, RefreshCw, Plus, Trash2, Edit3, Check, X, Shuffle, Layers, FileText, Terminal, Copy, Square, CheckSquare, ChevronDown, ChevronRight, Archive, Star, Tag, Filter, Home } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'
import useResizable from '../hooks/useResizable'
import PromptHistory from '../components/PromptHistory'
import FileTree from '../components/FileTree'
import CodeViewer from '../components/CodeViewer'
import LearnChat from '../components/LearnChat'


const TABS = [
  { key: 'guide', label: '指南', icon: BookOpen },
  { key: 'code', label: '代码', icon: Code },
  { key: 'notes', label: '笔记', icon: FileText },
  { key: 'cards', label: '卡片', icon: StickyNote },
  { key: 'prompt', label: '提示词', icon: Terminal },
  { key: 'promptHistory', label: '历史', icon: Archive },
]

export default function LearnStudio() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileAnalysis, setFileAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const fileSeqRef = useRef(0)
  const [tab, setTab] = useState('guide')
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showCardSidebar, setShowCardSidebar] = useState(true)
  const [showNoteSidebar, setShowNoteSidebar] = useState(true)
  const [showPromptSidebar, setShowPromptSidebar] = useState(true)
  const promptSidebarResize = useResizable(320, { min: 200, max: 500, side: 'right', storageKey: 'learn-prompt-sidebar-width' })
  // Prompt builder
  const [outline, setOutline] = useState([])
  const [assembledPrompt, setAssembledPrompt] = useState('')
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [assembleLoading, setAssembleLoading] = useState(false)

  const [notes, setNotes] = useState([])
  const [notesTag, setNotesTag] = useState(null)
  const [selectedNote, setSelectedNote] = useState(null)
  const [editingNote, setEditingNote] = useState(false)
  const [editNote, setEditNote] = useState({})
  const leftResize = useResizable(224, { min: 150, max: 400, side: 'right', storageKey: 'learn-left-width' })
  const rightResize = useResizable(320, { min: 200, max: 500, side: 'left', storageKey: 'learn-right-width' })
  const noteListResize = useResizable(320, { min: 200, max: 500, side: 'right', storageKey: 'learn-notelist-width' })
  const codeViewResize = useResizable(450, { min: 250, max: 1000, side: 'right', storageKey: 'learn-code-width' })

  // Study guide
  const [guide, setGuide] = useState(null)
  const [guideLoading, setGuideLoading] = useState(true)

  // Cards — loaded independently from DB
  const [cards, setCards] = useState([])
  const [cardTag, setCardTag] = useState(null)
  const [flippedCards, setFlippedCards] = useState({})
  // Card edit
  const [editingCard, setEditingCard] = useState(null)
  const [cardForm, setCardForm] = useState({ title: '', front: '', back: '', tags: [] })
  // Create card
  const [creatingCard, setCreatingCard] = useState(false)
  // Review mode (SM-2)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewStart, setReviewStart] = useState(null)
  const [reviewScope, setReviewScope] = useState('all') // 'all' | 'tag' | 'select'
  const [reviewTag, setReviewTag] = useState(null)
  const [cardSelection, setCardSelection] = useState({}) // for select mode
  const [showReviewPanel, setShowReviewPanel] = useState(false) // scope picker
  // Quick card form in notes tab
  const [quickCard, setQuickCard] = useState({ title: '', front: '', back: '', tags: '' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [noteToCardLoading, setNoteToCardLoading] = useState(false)
  const qcFrontRef = useRef(null)
  const qcBackRef = useRef(null)
  // Auto-resize quick card textareas
  useEffect(() => {
    [qcFrontRef, qcBackRef].forEach(ref => {
      const el = ref.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    })
  }, [quickCard.front, quickCard.back])

  // Learn tags
  const [learnTags, setLearnTags] = useState([])

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [p, n] = await Promise.all([
          api.getProject(id),
          api.getNotes(id).catch(() => []),
        ])
        setProject(p)
        setNotes(n)
      } catch { }
      // Load cards
      loadCards()
      // Load learn tags
      api.getLearnTags(id).then(setLearnTags).catch(() => {})
      // Load study guide
      setGuideLoading(true)
      try { setGuide(await api.getStudyGuide(id, false)) } catch { setGuide(null) }
      finally { setGuideLoading(false) }
    })()
  }, [id])

  async function loadOutline(force) {
    setOutlineLoading(true)
    try { setOutline((await api.getOutline(id, force)).outline || []) } catch { setOutline([]) }
    finally { setOutlineLoading(false) }
  }

  // Load outline when entering prompt tab
  useEffect(() => { if (tab === 'prompt' && outline.length === 0) loadOutline() }, [tab])

  function toggleSection(secId) {
    setOutline(prev => prev.map(s => s.id === secId ? { ...s, selected: !s.selected } : s))
  }
  function toggleSummary(secId, sumId) {
    setOutline(prev => prev.map(s => s.id === secId ? {
      ...s, items: s.items?.map(i => i.id === sumId ? { ...i, selected: !i.selected, children: i.children?.map(c => ({ ...c, selected: !i.selected })) } : i)
    } : s))
  }
  function toggleChild(secId, sumId, childId) {
    setOutline(prev => prev.map(s => s.id === secId ? {
      ...s, items: s.items?.map(i => i.id === sumId ? {
        ...i, selected: i.selected || i.children?.some(c => c.id === childId && !c.selected) ? true : false,
        children: i.children?.map(c => c.id === childId ? { ...c, selected: !c.selected } : c)
      } : i)
    } : s))
  }
  function toggleExpand(secId, sumId) {
    setOutline(prev => prev.map(s => s.id === secId ? {
      ...s, items: s.items?.map(i => i.id === sumId ? { ...i, expanded: !i.expanded } : i)
    } : s))
  }
  function selectAllInSection(secId) {
    setOutline(prev => prev.map(s => s.id === secId ? {
      ...s, selected: true,
      items: s.items?.map(i => ({ ...i, selected: true, children: i.children?.map(c => ({ ...c, selected: true })) }))
    } : s))
  }
  function deselectSection(secId) {
    setOutline(prev => prev.map(s => s.id === secId ? {
      ...s, selected: false,
      items: s.items?.map(i => ({ ...i, selected: false, children: i.children?.map(c => ({ ...c, selected: false })) }))
    } : s))
  }

  function countSelected() {
    let n = 0
    for (const cat of outline) {
      if (!cat.selected) continue
      for (const sum of (cat.items || [])) {
        n += (sum.children || []).filter(c => c.selected).length
      }
    }
    return n
  }
  async function handleAssemble() {
    const cats = outline.filter(s => s.selected)
    const allChildren = cats.flatMap(c => (c.items || []).flatMap(i => (i.children || []).filter(ch => ch.selected)))
    if (allChildren.length === 0) return alert('请先勾选要生成提示词的条目')

    // Build context with hierarchy
    const categories = cats.map(c => '## ' + c.title + '\n' + (c.items || []).filter(i => i.selected).map(i => {
      const selChildren = (i.children || []).filter(ch => ch.selected)
      if (selChildren.length === 0) return '- ' + i.text
      return '- ' + i.text + '\n' + selChildren.map(ch => '  - ' + ch.text).join('\n')
    }).join('\n')).join('\n\n')

    setAssembleLoading(true)
    try {
      const res = await api.assemblePrompt(id, { categories, items: allChildren.length })
      setAssembledPrompt(res.prompt || '生成失败')
    } catch (err) { alert('生成失败: ' + err.message) }
    finally { setAssembleLoading(false) }
  }

  function loadCards(tag) {
    api.getCards(id, tag).then(setCards).catch(() => setCards([]))
  }

  useEffect(() => { loadCards(cardTag) }, [cardTag])

  const handleSelectFile = useCallback(async (filePath) => {
    const seq = ++fileSeqRef.current
    setSelectedFile(filePath)
    setTab('code')
    setFileAnalysis(null)
    setAnalyzing(false)
    try {
      const data = await api.getFileContent(id, filePath)
      if (seq !== fileSeqRef.current) return
      setFileContent(data)
    } catch {
      if (seq !== fileSeqRef.current) return
      setFileContent(null)
    }
  }, [id])

  async function handleAnalyzeFile() {
    if (!selectedFile) return
    setAnalyzing(true)
    try {
      const result = await api.analyzeFile(id, selectedFile)
      setFileAnalysis(result.analysis)
    } catch (err) {
      setFileAnalysis('分析失败: ' + err.message)
    } finally { setAnalyzing(false) }
  }

  function handleSaveNote(title, content, tags) {
    api.saveNote(id, title, content, selectedFile, tags).then(note => {
      setNotes(prev => [note, ...prev])
    }).catch(err => alert(err.message))
  }

  function handleDeleteNote(noteId) {
    api.deleteNote(id, noteId).then(() => {
      setNotes(prev => prev.filter(n => n.id !== noteId))
    }).catch(err => alert(err.message))
  }

  function handleUpdateNote(noteId, data) {
    api.updateNote(id, noteId, data).then(updated => {
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n))
      if (selectedNote?.id === noteId) setSelectedNote(updated)
    }).catch(err => alert(err.message))
  }
  function saveNoteEdit() {
    if (!editNote.title) return
    handleUpdateNote(selectedNote.id, editNote)
    setEditingNote(false)
  }

  async function saveQuickCard() {
    if (!quickCard.title || !quickCard.front) return alert('标题和正面必填')
    setQuickSaving(true)
    try {
      const tagArr = (typeof quickCard.tags === 'string' ? quickCard.tags.split(',').map(s => s.trim()).filter(Boolean) : (quickCard.tags || []))
      await api.createCard(id, { title: quickCard.title, front: quickCard.front, back: quickCard.back, tags: tagArr })
      setQuickCard({ title: '', front: '', back: '', tags: '' })
      loadCards()
      api.getLearnTags(id).then(setLearnTags).catch(() => {})
    } catch (err) { alert('保存失败: ' + err.message) }
    finally { setQuickSaving(false) }
  }

  async function noteToCard() {
    if (!selectedNote || noteToCardLoading) return
    setNoteToCardLoading(true)
    try {
      const data = await api.createCard(id, { chatReply: selectedNote.content?.substring(0, 3000) || '', extractOnly: true })
      const noteTags = (selectedNote.tags || []).join(', ')
      setQuickCard({
        title: data.title || selectedNote.title,
        front: data.front || '',
        back: data.back || '',
        tags: noteTags,
      })
    } catch (err) { alert('AI生成失败: ' + err.message) }
    finally { setNoteToCardLoading(false) }
  }

  // ---- Card actions ----
  function toggleCard(idx) {
    setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function openCreateCard() { setCreatingCard(true); setCardForm({ title: '', front: '', back: '', tags: [] }) }
  function openEditCard(card) {
    setEditingCard(card.id)
    setCardForm({ title: card.title, front: card.content?.front || '', back: card.content?.back || '', tags: card.tags || [] })
  }
  function cancelCardForm() { setEditingCard(null); setCreatingCard(false); setCardForm({}) }

  async function saveCardForm() {
    const { title, front, back, tags } = cardForm
    if (!title || !front) return alert('标题和正面内容必填')
    const ct = typeof cardForm.content === 'string' ? cardForm.content : JSON.stringify({ front, back })
    try {
      if (editingCard) {
        const updated = await api.updateCard(id, editingCard, { title, front, back, tags })
        setCards(prev => prev.map(c => c.id === editingCard ? updated : c))
      } else {
        const created = await api.createCard(id, { title, front, back, tags })
        setCards(prev => [created, ...prev])
      }
      cancelCardForm()
      api.getLearnTags(id).then(setLearnTags).catch(() => {})
    } catch (err) { alert('保存失败: ' + err.message) }
  }

  async function handleDeleteCard(cardId) {
    if (!confirm('删除这张卡片？')) return
    await api.deleteCard(id, cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
  }

  // Review mode
  function startReview() {
    let queue = cards
    if (reviewScope === 'tag' && reviewTag) queue = cards.filter(c => (c.tags || []).includes(reviewTag))
    if (reviewScope === 'select') queue = cards.filter(c => cardSelection[c.id])
    // SM-2: only due cards, plus any manually selected
    if (reviewScope !== 'select') {
      const today = new Date().toISOString().slice(0, 10)
      queue = queue.filter(c => (c.next_review || today) <= today)
    }
    if (queue.length === 0) return alert('没有需要复习的卡片')
    // Sort: overdue first, then random within same date
    queue.sort((a, b) => (a.next_review || '').localeCompare(b.next_review || '') || Math.random() - 0.5)
    setReviewQueue(queue)
    setReviewIdx(0)
    setReviewMode(true)
    setShowReviewPanel(false)
    setFlippedCards({})
    setReviewStart(Date.now())
  }

  async function handleReview(quality) {
    const card = reviewQueue[reviewIdx]
    try {
      await api.reviewCard(id, card.id, quality)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, interval_days: quality < 2 ? 1 : c.interval_days + 1 } : c))
    } catch {}
    if (reviewIdx + 1 >= reviewQueue.length) {
      const elapsed = Math.round((Date.now() - reviewStart) / 1000)
      alert(`复习完成！\n用时 ${elapsed} 秒，共 ${reviewQueue.length} 张卡片`)
      setReviewMode(false)
    } else {
      setReviewIdx(prev => prev + 1)
    }
  }

  // Guide
  async function regenerateGuide() {
    setGuideLoading(true)
    setGuide(null)
    try { setGuide(await api.getStudyGuide(id, true)) } catch (err) { alert('生成失败: ' + err.message) }
    finally { setGuideLoading(false) }
  }

  if (!project) return <div className="flex h-screen items-center justify-center text-gray-400">加载中...</div>

  // ---- Card form fields parsing ----
  const cardContent = typeof cardForm.content === 'string' ? (() => { try { return JSON.parse(cardForm.content) } catch { return {} } })() : cardForm

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-3">
        <Link to={`/project/${id}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><ArrowLeft size={18} /></Link>
        <Link to="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="首页"><Home size={16} /></Link>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{project.name}</h1>
        <span className="text-xs text-gray-400">学习工作室</span>
        <div className="flex-1" />
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: File tree */}
        {showLeftPanel && (<>
          <div className="flex-shrink-0 overflow-y-auto bg-white dark:bg-gray-900" style={{ width: leftResize.width }}>
            <FileTree projectId={id} selectedFile={selectedFile} onSelect={handleSelectFile} />
          </div>
          <div onMouseDown={leftResize.onMouseDown} className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />
        </>)}

        {/* Center */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-2 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-0">
              <button onClick={() => setShowLeftPanel(!showLeftPanel)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0" title={showLeftPanel ? '隐藏文件树' : '显示文件树'}>
                {showLeftPanel ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
              </button>
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors -mb-px ${tab === key ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
              {guide?.cached && tab === 'guide' && (
                <span className="self-center ml-2 px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">缓存</span>
              )}
              {tab === 'guide' && (
                <button onClick={regenerateGuide} disabled={guideLoading}
                  className="self-center ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RefreshCw size={11} className={guideLoading ? 'animate-spin' : ''} /> 重生成
                </button>
              )}
              <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-auto flex-shrink-0" title={showRightPanel ? '隐藏对话' : '显示对话'}>
                {showRightPanel ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Guide tab */}
            {tab === 'guide' && (
              <div className="p-4">
                {guideLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
                    <Loader2 size={14} className="animate-spin" /> {guide ? '重新生成中...' : 'AI 正在生成学习指南...'}
                  </div>
                ) : guide?.overview ? (
                  <div className="markdown-body text-sm text-gray-700 dark:text-gray-300 max-w-4xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{guide.overview}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                    <button onClick={regenerateGuide} className="text-blue-600 hover:underline">点击生成学习指南</button>
                  </div>
                )}
              </div>
            )}

            {/* Code tab */}
            {tab === 'code' && <CodeViewer filePath={selectedFile} content={fileContent} analysis={fileAnalysis} analyzing={analyzing} projectId={id} onAnalyze={handleAnalyzeFile} codeWidth={codeViewResize.width} onCodeResize={codeViewResize.onMouseDown} onCardCreated={() => { loadCards(); api.getLearnTags(id).then(setLearnTags).catch(() => {}) }} />}

            {/* Cards tab */}
            {tab === 'cards' && (
              <div className="flex h-full">
                {/* Card tag sidebar */}
                {showCardSidebar && (
                <div className="w-36 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">标签</span>
                    <button onClick={() => setShowCardSidebar(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                  </div>
                  <button onClick={() => setCardTag(null)}
                    className={`w-full text-left px-2 py-1 text-xs rounded mb-0.5 ${!cardTag ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    全部 ({cards.length})
                  </button>
                  {learnTags.map(t => (
                    <button key={t.name} onClick={() => setCardTag(cardTag === t.name ? null : t.name)}
                      className={`w-full text-left px-2 py-1 text-xs rounded mb-0.5 flex justify-between ${cardTag === t.name ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      <span>{t.name}</span>
                      <span className="text-[10px] opacity-70">{t.count}</span>
                    </button>
                  ))}
                </div>
                )}
                {/* Card content */}
                <div className="flex-1 overflow-y-auto p-4">
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button onClick={openCreateCard}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    <Plus size={12} /> 创建卡片
                  </button>
                  <button onClick={() => setShowReviewPanel(true)} disabled={cards.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                    <Shuffle size={12} /> 复习
                  </button>
                  {!showCardSidebar && (
                    <button onClick={() => setShowCardSidebar(true)} className="text-xs text-gray-400 hover:text-gray-600">
                      标签
                    </button>
                  )}
                  <button onClick={() => setCardSelection({})} className="text-xs text-gray-400 hover:text-gray-600">
                    清空选择
                  </button>
                  {cards.length > 0 && (
                    <button onClick={() => setFlippedCards(cards.length > 0 && Object.values(flippedCards).every(Boolean) ? {} : Object.fromEntries(cards.map((_, i) => [i, true])))}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Layers size={12} /> {Object.values(flippedCards).every(Boolean) ? '全部翻回' : '全部翻转'}
                    </button>
                  )}


                </div>

                {/* Card create/edit form */}
                {(creatingCard || editingCard) && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="grid gap-2">
                      <input type="text" value={cardForm.title} onChange={e => setCardForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="卡片标题" className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                      <textarea value={cardForm.front} onChange={e => setCardForm(p => ({ ...p, front: e.target.value }))}
                        placeholder="正面内容（概念解释+项目例子）" rows={2} className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                      <textarea value={cardForm.back} onChange={e => setCardForm(p => ({ ...p, back: e.target.value }))}
                        placeholder="背面内容（大白话比喻）" rows={2} className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                      <input type="text" value={(cardForm.tags || []).join(', ')}
                        onChange={e => setCardForm(p => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        placeholder="标签（逗号分隔）" className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800" />
                      <div className="flex justify-end gap-2">
                        <button onClick={cancelCardForm} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"><X size={12} /> 取消</button>
                        <button onClick={saveCardForm} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"><Check size={12} /> 保存</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review mode */}
                {/* Review mode: SM-2 scoring */}
                {reviewMode && reviewIdx < reviewQueue.length && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
                      复习 {reviewIdx + 1}/{reviewQueue.length} — {reviewQueue[reviewIdx].title}
                    </div>
                    <div onClick={() => setFlippedCards(p => ({ ...p, [cards.indexOf(reviewQueue[reviewIdx])]: !p[cards.indexOf(reviewQueue[reviewIdx])] }))}
                      className="rounded-lg border p-4 cursor-pointer min-h-[100px] bg-white dark:bg-gray-900">
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        {flippedCards[cards.indexOf(reviewQueue[reviewIdx])]
                          ? (reviewQueue[reviewIdx].content?.back || '')
                          : (reviewQueue[reviewIdx].content?.front || '')}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleReview(0)} className="flex-1 px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">忘记</button>
                      <button onClick={() => handleReview(1)} className="flex-1 px-2 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">困难</button>
                      <button onClick={() => handleReview(2)} className="flex-1 px-2 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">正常</button>
                      <button onClick={() => handleReview(3)} className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">简单</button>
                    </div>
                  </div>
                )}
                {reviewMode && reviewIdx >= reviewQueue.length && (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 text-center">
                    <p className="text-sm text-green-700 dark:text-green-400">复习完成！</p>
                    <button onClick={() => setReviewMode(false)} className="mt-2 px-4 py-1 text-xs bg-green-600 text-white rounded">返回</button>
                  </div>
                )}

                {/* Review scope panel */}
                {showReviewPanel && (
                  <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-lg border shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 mb-2">选择复习范围</div>
                    <div className="flex gap-1 mb-2">
                      {[{ k: 'all', l: '全部' }, { k: 'tag', l: '按标签' }, { k: 'select', l: '手动选择' }].map(o => (
                        <button key={o.k} onClick={() => setReviewScope(o.k)}
                          className={`px-2 py-1 text-xs rounded ${reviewScope === o.k ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>{o.l}</button>
                      ))}
                    </div>
                    {reviewScope === 'tag' && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {learnTags.map(t => (
                          <button key={t.name} onClick={() => setReviewTag(t.name)}
                            className={`px-2 py-0.5 text-[10px] rounded-full ${reviewTag === t.name ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{t.name} ({t.count})</button>
                        ))}
                      </div>
                    )}
                    {reviewScope === 'select' && (
                      <p className="text-[10px] text-gray-400 mb-2">已选 {Object.values(cardSelection).filter(Boolean).length} 张</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={startReview} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">开始复习</button>
                      <button onClick={() => setShowReviewPanel(false)} className="px-3 py-1 text-xs text-gray-500">取消</button>
                    </div>
                  </div>
                )}

                {/* Card grid */}
                {cards.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">暂无卡片。点击"创建卡片"或从 AI 对话中生成。</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
                    {cards.map((card, idx) => {
                      const flipped = flippedCards[idx]
                      return (
                        <div key={card.id}
                          onClick={() => toggleCard(idx)}
                          className={`rounded-lg border p-4 cursor-pointer min-h-[120px] transition-all duration-300 group ${
                            flipped ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                              <input type="checkbox" checked={!!cardSelection[card.id]}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setCardSelection(prev => ({ ...prev, [card.id]: e.target.checked }))}
                                className="rounded" />
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{card.title}</span>
                              {card.next_review && card.next_review <= new Date().toISOString().slice(0, 10) && (
                                <span className="px-1 py-0.5 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded" title="待复习">待复习</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); openEditCard(card) }}
                                className="text-gray-400 hover:text-gray-600"><Edit3 size={10} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id) }}
                                className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                            {flipped ? (card.content?.back || '暂无背面') : (card.content?.front || '暂无正面')}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {card.tags?.length > 0 && card.tags.map(t => (
                              <span key={t} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">{t}</span>
                            ))}
                            {card.file_path && (
                              <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{card.file_path.split('/').pop()}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Prompt builder tab */}
            {tab === 'prompt' && (
              <div className="flex h-full">
                {/* Left: Outline tree */}
                {showPromptSidebar && (<>
                <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col" style={{ width: promptSidebarResize.width }}>
                  <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">大纲条目</span>
                        <button onClick={() => loadOutline(true)} className="text-xs text-blue-600 hover:underline">{outlineLoading ? '生成中...' : '刷新'}</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={handleAssemble} disabled={outline.length === 0 || assembleLoading}
                          className="px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                          {assembleLoading ? 'AI 正在生成...' : '生成 (' + countSelected() + ')'}
                        </button>
                        <button onClick={() => setShowPromptSidebar(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                  {outline.length === 0 ? (
                    <p className="text-xs text-gray-400">无大纲，请先生成学习指南</p>
                  ) : outline.map(sec => (
                    <div key={sec.id} className="mb-2">
                      <div className="flex items-center gap-1.5 px-1 py-0.5 rounded group hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <input type="checkbox" checked={sec.selected} onChange={() => toggleSection(sec.id)} className="rounded" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1">{sec.title}</span>
                        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
                          <button onClick={(e) => { e.preventDefault(); selectAllInSection(sec.id) }} className="hover:text-blue-600 mr-1">全选</button>
                          <button onClick={(e) => { e.preventDefault(); deselectSection(sec.id) }} className="hover:text-red-500">取消</button>
                        </span>
                      </div>
                      {sec.selected && sec.items?.map(sum => (
                        <div key={sum.id} className="ml-2">
                          <div className="flex items-center gap-1 px-0.5 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <button onClick={() => toggleExpand(sec.id, sum.id)} className="text-gray-400">
                              {sum.expanded !== false ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            </button>
                            <input type="checkbox" checked={sum.selected} onChange={() => toggleSummary(sec.id, sum.id)} className="rounded" />
                            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 truncate">{sum.text}</span>
                          </div>
                          {sum.expanded !== false && sum.children?.map(child => (
                            <label key={child.id} className="flex items-center gap-1.5 ml-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 px-1 py-0.5 rounded">
                              <input type="checkbox" checked={child.selected} onChange={() => toggleChild(sec.id, sum.id, child.id)} className="rounded" />
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{child.text}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                  </div>
                </div>
                <div onMouseDown={promptSidebarResize.onMouseDown}
                  className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />
                </>)}
                {!showPromptSidebar && (
                  <button onClick={() => setShowPromptSidebar(true)}
                    className="flex-shrink-0 px-2 text-xs text-gray-400 hover:text-gray-600 border-r border-gray-200 dark:border-gray-700">大纲</button>
                )}
                {/* Right: Assembled prompt */}
                <div className="flex-1 overflow-y-auto p-4">
                  {assembledPrompt ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">生成结果</span>
                        <button onClick={() => { navigator.clipboard.writeText(assembledPrompt); alert('已复制') }}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"><Copy size={12} /> 复制</button>
                      </div>
                      <div className="markdown-body text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-3 max-w-4xl">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{assembledPrompt}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-gray-400">勾选左侧大纲条目，点击"生成"</div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt history tab */}
            {tab === 'promptHistory' && (
              <PromptHistory projectId={id} />
            )}

            {/* Notes tab */}
            {tab === 'notes' && (
              <div className="flex h-full">
                {showNoteSidebar && (<>
                <div className="flex-shrink-0 overflow-y-auto" style={{ width: noteListResize.width }}>
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">笔记列表</span>
                    <button onClick={() => setShowNoteSidebar(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                    <button onClick={() => setNotesTag(null)}
                      className={`px-2 py-0.5 text-[10px] rounded-full ${!notesTag ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>全部</button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="p-3 text-xs text-gray-400">暂无笔记</p>
                  ) : notes.map(n => (
                    <div key={n.id} onClick={() => setSelectedNote(n)}
                      className={`px-3 py-2 border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedNote?.id === n.id ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{n.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id) }}
                          className="opacity-0 hover:opacity-100 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{new Date(n.updated_at || n.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                  {/* Quick card form */}
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">快速卡片</div>
                    <input type="text" value={quickCard.title} onChange={e => setQuickCard(p => ({ ...p, title: e.target.value }))}
                      placeholder="卡片标题" className="w-full text-xs border rounded px-2 py-1 mb-1.5 bg-white dark:bg-gray-800" />
                    <textarea ref={qcFrontRef} value={quickCard.front} onChange={e => { setQuickCard(p => ({ ...p, front: e.target.value })) }}
                      placeholder="正面" rows={1} className="w-full text-xs border rounded px-2 py-1 mb-1.5 bg-white dark:bg-gray-800 resize-none" />
                    <textarea ref={qcBackRef} value={quickCard.back} onChange={e => { setQuickCard(p => ({ ...p, back: e.target.value })) }}
                      placeholder="背面（大白话比喻）" rows={1} className="w-full text-xs border rounded px-2 py-1 mb-1.5 bg-white dark:bg-gray-800 resize-none" />
                    <input type="text" value={typeof quickCard.tags==='string'?quickCard.tags:(quickCard.tags||[]).join(', ')}
                      onChange={e => setQuickCard(p => ({ ...p, tags: e.target.value }))}
                      placeholder="标签（逗号分隔）" className="w-full text-xs border rounded px-2 py-1 mb-1.5 bg-white dark:bg-gray-800" />
                    <button onClick={saveQuickCard} disabled={quickSaving}
                      className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {quickSaving ? '保存中...' : '创建卡片'}
                    </button>
                  </div>
                </div>
                <div onMouseDown={noteListResize.onMouseDown}
                  className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />
                </>)}
                {!showNoteSidebar && (
                  <button onClick={() => setShowNoteSidebar(true)}
                    className="flex-shrink-0 px-2 text-xs text-gray-400 hover:text-gray-600 border-r border-gray-200 dark:border-gray-700">列表</button>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedNote ? (
                    editingNote ? (
                      <div className="max-w-3xl">
                        <input type="text" value={editNote.title} onChange={e => setEditNote(p => ({ ...p, title: e.target.value }))}
                          className="w-full text-sm font-semibold border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                        <textarea value={editNote.content} onChange={e => setEditNote(p => ({ ...p, content: e.target.value }))}
                          rows={10} className="w-full text-sm border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                        <input type="text" value={(editNote.tags || []).join(', ')}
                          onChange={e => setEditNote(p => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          placeholder="标签（逗号分隔）" className="w-full text-xs border rounded px-2 py-1 mb-2 bg-white dark:bg-gray-800" />
                        <div className="flex gap-2">
                          <button onClick={saveNoteEdit} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">保存</button>
                          <button onClick={() => setEditingNote(false)} className="px-3 py-1 text-xs text-gray-500">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-3xl">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedNote.title}</h2>
                          <div className="flex items-center gap-1">
                            <button onClick={noteToCard} disabled={noteToCardLoading}
                            className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50">{noteToCardLoading ? 'AI生成中...' : 'AI生成卡片'}</button>
                            <button onClick={() => { setEditNote({ title: selectedNote.title, content: selectedNote.content, tags: selectedNote.tags || [] }); setEditingNote(true) }}
                              className="text-xs text-gray-400 hover:text-gray-600"><Edit3 size={12} /></button>
                            <button onClick={() => { handleDeleteNote(selectedNote.id); setSelectedNote(null) }}
                              className="text-xs text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        {(selectedNote.tags || []).length > 0 && (
                          <div className="flex gap-1 mb-3 flex-wrap">
                            {selectedNote.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">{t}</span>)}
                          </div>
                        )}
                        <div className="markdown-body text-sm text-gray-700 dark:text-gray-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{selectedNote.content || ''}</ReactMarkdown>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-gray-400">选择一条笔记查看</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        {showRightPanel && (<>
          <div onMouseDown={rightResize.onMouseDown} className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 flex flex-col" style={{ width: rightResize.width }}>
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-2 py-1.5">
              <span className="text-xs font-semibold text-gray-500">AI 对话</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <LearnChat projectId={id} filePath={selectedFile} fileContent={fileContent} compact onSaveNote={handleSaveNote} />
            </div>
          </div>
        </>)}
      </div>
    </div>
  )
}
