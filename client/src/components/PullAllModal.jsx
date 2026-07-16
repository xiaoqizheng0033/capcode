import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check, AlertTriangle, DownloadCloud, Copy, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { api } from '../api'

/**
 * Pull-all modal: streams per-project pull progress via SSE, then renders an
 * AI-generated Markdown update report. Closing mid-run is safe — the server
 * finishes regardless; onClose() triggers a Dashboard refresh.
 */
export default function PullAllModal({ onClose }) {
  // 'pulling' -> 'reporting' -> 'done' | 'error'
  const [stage, setStage] = useState('pulling')
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const logEndRef = useRef(null)
  const reportRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        await api.pullAllProjects(({ eventType, data }) => {
          if (cancelled) return
          if (eventType === 'progress') {
            setLogs(prev => [...prev, data])
          } else if (eventType === 'pulls-done') {
            setSummary(data.summary)
          } else if (eventType === 'report-generating') {
            setStage('reporting')
          } else if (eventType === 'done') {
            setSummary(data.summary)
            setReport(data.report || '')
            setStage('done')
          }
        })
        if (!cancelled && stage !== 'done' && stage !== 'error') {
          // Stream ended without explicit done event — safety net
          setStage('done')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || '拉取失败')
          setStage('error')
        }
      }
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll log panel to bottom on new entries
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [logs])

  function copyReport() {
    navigator.clipboard?.writeText(report).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // Download the report as a local Markdown file via Blob. Filename is timestamped
  // so each pull-all run produces a distinct file (e.g. update-report-2026-07-12-153020.md).
  function saveReport() {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '').replace(/-(\d{2})-(\d{2})-(\d{2})$/, '-$1-$2-$3')
    const fileName = `update-report-${stamp}.md`
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isRunning = stage === 'pulling' || stage === 'reporting'

  function logLineClassName(entry) {
    if (entry.stage === 'pull-failed') return 'text-red-400'
    if (entry.stage === 'pulled') {
      return entry.result?.status === 'no_change' ? 'text-gray-500' : 'text-green-400'
    }
    return 'text-blue-300'
  }

  function formatLog(entry) {
    const name = entry.project?.name || '?'
    if (entry.stage === 'pulling') {
      return entry.message ? `▸ ${name}: ${entry.message}` : `▸ ${name}: 开始拉取...`
    }
    if (entry.stage === 'pull-failed') {
      return `✗ ${name}: 失败 - ${entry.error || '未知错误'}`
    }
    // pulled
    if (entry.result?.status === 'no_change') return `• ${name}: 无更新`
    return `✓ ${name}: ${entry.result?.commitsCount || 0} 个新提交`
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <DownloadCloud size={18} className="text-blue-600 dark:text-blue-400" />
            拉取所有项目更新
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Summary badges */}
          {summary && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge label="总计" value={summary.total} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" />
              <Badge label="已更新" value={summary.updated} className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" />
              <Badge label="无变化" value={summary.noChange} className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400" />
              <Badge label="失败" value={summary.failed} className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" />
            </div>
          )}

          {/* Stage 1/2: terminal log */}
          {(stage === 'pulling' || stage === 'reporting' || stage === 'error') && (
            <div className="bg-gray-950 rounded-md p-3 h-64 overflow-y-auto font-mono text-xs leading-relaxed">
              {logs.length === 0 && (
                <div className="text-gray-500">开始拉取...</div>
              )}
              {logs.map((entry, i) => (
                <div key={i} className={logLineClassName(entry)}>{formatLog(entry)}</div>
              ))}
              {stage === 'reporting' && (
                <div className="text-amber-400 mt-2 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  AI 正在生成更新报告...
                </div>
              )}
              {stage === 'error' && (
                <div className="text-red-400 mt-2">✗ 错误: {error}</div>
              )}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Stage 3: AI report */}
          {stage === 'done' && report && (
            <div className="relative">
              <div className="absolute -top-1 right-0 flex items-center gap-2">
                <button
                  onClick={copyReport}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="复制报告为 Markdown"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={saveReport}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  title="保存报告为本地 .md 文件"
                >
                  {saved ? <Check size={12} /> : <Save size={12} />}
                  {saved ? '已保存' : '保存'}
                </button>
              </div>
              <div ref={reportRef} className="markdown-body text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{report}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Empty-state when no projects */}
          {stage === 'done' && !report && (
            <div className="text-center text-gray-400 dark:text-gray-500 py-8">
              <AlertTriangle size={28} className="mx-auto mb-2 opacity-60" />
              没有可拉取的项目或报告内容为空。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {stage === 'pulling' && '正在逐个拉取项目...'}
            {stage === 'reporting' && 'AI 报告生成中，请稍候...'}
            {stage === 'done' && '完成'}
            {stage === 'error' && `出错: ${error}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {isRunning ? '关闭（后台继续）' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

function Badge({ label, value, className }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${className}`}>
      <span className="opacity-80">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}
