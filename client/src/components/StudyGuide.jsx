import { useState, useEffect } from 'react'
import { BookOpen, StickyNote, Loader2, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'

export default function StudyGuide({ projectId }) {
  const [guide, setGuide] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [flippedCards, setFlippedCards] = useState({})

  useEffect(() => { loadGuide() }, [projectId])

  async function loadGuide() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getStudyGuide(projectId, false)
      setGuide(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleCard(idx) {
    setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  if (loading && !guide) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 size={14} className="animate-spin" /> AI 正在分析项目，生成学习指南...
      </div>
    )
  }

  if (error && !guide) {
    return <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">{error}</div>
  }

  if (!guide) return <p className="text-sm text-gray-400">暂无数据</p>

  let cards = []
  try { cards = JSON.parse(guide.cards || '[]') } catch {}

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('overview')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <BookOpen size={13} /> 学习指南
          </button>
          <button
            onClick={() => setTab('cards')}
            disabled={cards.length === 0}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === 'cards' ? 'bg-blue-600 text-white'
                : cards.length > 0 ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <StickyNote size={13} /> 卡片 ({cards.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          {guide.cached && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">缓存</span>
          )}
          <button onClick={() => { setGuide(null); setLoading(true); api.getStudyGuide(projectId, true).then(setGuide).catch(e => setError(e.message)).finally(() => setLoading(false)) }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <RefreshCw size={12} /> 重生成
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'overview' && (
        <div className="markdown-body text-sm text-gray-700 dark:text-gray-300 max-h-[600px] overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {guide.overview || '暂无内容'}
          </ReactMarkdown>
        </div>
      )}

      {tab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((card, idx) => {
            const flipped = flippedCards[idx]
            return (
              <div
                key={idx}
                onClick={() => toggleCard(idx)}
                className={`rounded-lg border p-4 cursor-pointer min-h-[120px] transition-all duration-300 ${
                  flipped
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{card.title}</span>
                  <span className="text-[10px] text-gray-400">{flipped ? '背面' : '正面 · 点击翻转'}</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {flipped ? card.back : card.front}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
