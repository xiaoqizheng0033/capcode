import { useState, useEffect } from 'react'
import { Loader2, ChevronRight, Copy, Check, RefreshCw, ArrowLeft } from 'lucide-react'
import { api } from '../api'

const INDENT = 24

export default function CallChain({ projectId }) {
  const [topics, setTopics] = useState(null) // null=loading, [] = no topics
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [chainLoading, setChainLoading] = useState(false)
  const [chainResult, setChainResult] = useState(null)
  const [chainError, setChainError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(null)

  // Load topics on mount
  useEffect(() => {
    setTopicsLoading(true)
    api.getCallChainTopics(projectId)
      .then(data => setTopics(data.topics || []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false))
  }, [projectId])

  async function handleTopicClick(query) {
    setSelectedQuery(query)
    setChainLoading(true)
    setChainError('')
    setChainResult(null)
    try {
      const data = await api.getCallChain(projectId, query)
      setChainResult(data)
    } catch (err) {
      setChainError(err.message)
    } finally {
      setChainLoading(false)
    }
  }

  function handleBack() {
    setSelectedQuery(null)
    setChainResult(null)
    setChainError('')
  }

  async function handleRegenTopics() {
    // Clear cache and reload
    setTopicsLoading(true)
    api.getCallChainTopics(projectId)
      .then(data => setTopics(data.topics || []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false))
  }

  async function handleCopy(node, idx) {
    const text = node.file ? `${node.file}:${node.line || 1}` : node.description
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  // ----- View: Chain result (after topic clicked) -----
  if (selectedQuery) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={handleBack} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{selectedQuery}</span>
          <span className="text-xs text-gray-400">调用链</span>
          {chainResult?.cached && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">缓存</span>
          )}
        </div>

        {chainError && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2 mb-3">{chainError}</div>
        )}

        {chainLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 size={14} className="animate-spin" /> 分析中...
          </div>
        )}

        {chainResult && chainResult.chain && chainResult.chain.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {chainResult.chain.map((node, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors group"
                style={{ paddingLeft: `${12 + node.level * INDENT}px` }}
              >
                {node.level > 0 && (
                  <ChevronRight size={12} className="mt-1 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {node.function && (
                      <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {node.function}()
                      </span>
                    )}
                    {node.file && (
                      <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                        {node.file}{node.line ? `:${node.line}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{node.description}</p>
                </div>
                <button
                  onClick={() => handleCopy(node, idx)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                  title="复制路径"
                >
                  {copiedIdx === idx ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ----- View: Topics list (default) -----
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">选择要追踪的功能点</span>
        <button onClick={handleRegenTopics} disabled={topicsLoading} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50">
          <RefreshCw size={12} className={topicsLoading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {topicsLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 size={14} className="animate-spin" /> AI 分析项目中...
        </div>
      ) : topics.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">AI 未能识别出可追踪的功能点</p>
      ) : (
        <div className="space-y-1">
          {topics.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              {topic}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
