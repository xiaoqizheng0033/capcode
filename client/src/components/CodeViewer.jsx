import { useState } from 'react'
import { useRef, useEffect, useCallback } from 'react'
import { Loader2, Languages, PanelLeftClose, PanelLeft, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'

export default function CodeViewer({ filePath, content, analysis, analyzing, projectId, onAnalyze, codeWidth, onCodeResize, onCardCreated }) {
  const [bilingual, setBilingual] = useState(false)
  const [translated, setTranslated] = useState('')
  const [vocab, setVocab] = useState([])
  const [translating, setTranslating] = useState(false)
  const [showCode, setShowCode] = useState(true)
  const [showAnalysis, setShowAnalysis] = useState(true)
  // Inline translation popup
  const [selText, setSelText] = useState('')
  const [selTrans, setSelTrans] = useState('')
  const [selTransing, setSelTransing] = useState(false)
  const [selPos, setSelPos] = useState(null)
  const codeRef = useRef(null)

  async function toggleBilingual() {
    if (bilingual) { setBilingual(false); return }
    setBilingual(true)
    if (translated) return
    setTranslating(true)
    try {
      const data = await api.translateFile(projectId, filePath)
      setTranslated(data.translated || '')
      setVocab(data.vocab || [])
    } catch (err) {
      setTranslated('翻译失败: ' + err.message)
    } finally { setTranslating(false) }
  }

  const handleMouseUp = useCallback((e) => {
    const sel = window.getSelection()
    const text = sel?.toString().trim()
    if (!text || text.length < 3) { setSelText(''); setSelTrans(''); setSelPos(null); return }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (!codeRef.current?.contains(range.startContainer)) { setSelText(''); setSelTrans(''); setSelPos(null); return }
    setSelText(text)
    setSelTrans('')
    setSelPos({ top: rect.bottom + 4, left: rect.left })
  }, [])

  async function translateSelection() {
    if (!selText || selTransing) return
    setSelTransing(true)
    try {
      const p = `请将以下英文翻译成中文，保留技术术语的准确性：\n\n${selText.substring(0, 500)}`
      const res = await fetch(`/api/projects/${projectId}/learn-chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: p }], fileContext: '', filePath: '' }) })
      const data = await res.json()
      setSelTrans(data.reply || '翻译失败')
    } catch (err) { setSelTrans('翻译失败: ' + err.message) }
    finally { setSelTransing(false) }
  }

  function closeSel() { setSelText(''); setSelTrans(''); setSelPos(null) }

  useEffect(() => { if (!selText) return; const onKey = (e) => { if (e.key === 'Escape') closeSel() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [selText])

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        请在左侧选择一个文件开始学习
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900">
        <h2 className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 truncate">{filePath}</h2>
        {content && <span className="text-xs text-gray-400">{content.lines} 行</span>}
        <button onClick={() => setShowCode(!showCode)} className="p-0.5 text-gray-400 hover:text-gray-600" title={showCode ? '隐藏代码' : '显示代码'}>
          {showCode ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
        {!showAnalysis && (
          <button onClick={() => setShowAnalysis(true)} className="text-xs text-gray-400 hover:text-gray-600">分析</button>
        )}
        <div className="flex-1" />
        <button onClick={toggleBilingual} disabled={translating}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${bilingual ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
          {translating ? <><Loader2 size={11} className="animate-spin" /></> : <><Languages size={11} /> {bilingual ? '原文' : '中英对照'}</>}
        </button>
      </div>

      {/* Vocab */}
      {vocab.length > 0 && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-800 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-green-600 mr-1">词汇:</span>
            {vocab.map((v, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-800 flex items-center gap-1">
                <span className="font-semibold text-green-700 dark:text-green-400">{v.word}</span>
                <span className="text-gray-600 dark:text-gray-400">{v.meaning}</span>
                <button onClick={async () => {
                  try {
                    await api.createCard(projectId, { title: v.word, front: v.word, back: v.meaning + (v.context ? ' · ' + v.context : ''), tags: ['技术英语'] })
                    setVocab(prev => prev.filter((_, j) => j !== i))
                    if (onCardCreated) onCardCreated()
                  } catch {}
                }}
                  className="ml-1 text-gray-400 hover:text-green-600" title="存为卡片">+</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Body: code left + analysis right */}
      <div className="flex flex-1 min-h-0">
        {/* Code panel */}
        {showCode && (<>
        <div ref={codeRef} onMouseUp={handleMouseUp}
          className={`overflow-auto bg-gray-950 ${showAnalysis ? 'flex-shrink-0' : 'flex-1'}`} style={showAnalysis ? { width: codeWidth } : {}}>
          {bilingual && translated ? (
            <pre className="text-xs leading-relaxed p-3 m-0 text-green-400 whitespace-pre-wrap font-mono">{translated}</pre>
          ) : (content && (
            <div>
              {content.content.split('\n').map((line, i) => (
                <div key={i} className="flex hover:bg-gray-800/50 min-h-[1.4rem]">
                  <span className="w-10 flex-shrink-0 text-right pr-2 select-none text-gray-500 border-r border-gray-700 mr-2">{i + 1}</span>
                  <span className="text-green-400 whitespace-pre flex-1 overflow-x-auto text-xs font-mono">{line || ' '}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Resize handle */}
        <div onMouseDown={onCodeResize}
          className="w-1.5 flex-shrink-0 cursor-col-resize hover:bg-blue-400/50 transition-colors z-10" />
        </>)}

        {/* Analysis panel */}
        {showAnalysis && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">AI 分析</h3>
            <div className="flex items-center gap-1">
              <button onClick={onAnalyze} disabled={analyzing}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded disabled:opacity-50">
                {analyzing ? <><Loader2 size={11} className="animate-spin" /> 分析中</> : '开始分析'}
              </button>
              <button onClick={() => setShowAnalysis(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
          </div>
          {analyzing ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-4">
              <Loader2 size={14} className="animate-spin" /> AI 正在分析代码...
            </div>
          ) : analysis ? (
            <div className="markdown-body text-sm text-gray-700 dark:text-gray-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{analysis}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4">点击"开始分析"让 AI 解读代码</p>
          )}
        </div>
        )}
      </div>

      {/* Inline translation popup */}
      {selText && selPos && (
        <div className="fixed z-50 max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3"
          style={{ top: selPos.top, left: selPos.left }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">翻译</span>
            <div className="flex items-center gap-1">
              {!selTrans && (
                <button onClick={translateSelection} disabled={selTransing}
                  className="text-[10px] text-blue-600 hover:underline">{selTransing ? '翻译中...' : '翻译'}</button>
              )}
              <button onClick={closeSel} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 line-clamp-3 italic">"{selText.substring(0, 200)}"</p>
          {selTrans && (
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{selTrans}</p>
              <button onClick={async () => {
                try {
                  await api.createCard(projectId, { title: selText.substring(0, 30), front: selText.substring(0, 200), back: selTrans, tags: ['技术英语'] })
                  if (onCardCreated) onCardCreated()
                  closeSel()
                } catch {}
              }} className="text-[10px] text-green-600 hover:underline">生成卡片</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
