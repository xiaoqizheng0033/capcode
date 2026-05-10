import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

export default function AddProjectModal({ open, onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!open) return null

  const repoName = url.split('/').pop()?.replace(/\.git$/, '') || ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setLogs([])

    try {
      const res = await fetch('/api/projects/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

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
              setLogs(prev => [...prev, { type: 'info', text: data.message }])
            } else if (eventType === 'done') {
              setLogs(prev => [...prev, { type: 'success', text: '克隆完成' }])
              setLoading(false)
              setUrl('')
              onAdded(data.project)
            } else if (eventType === 'error') {
              setLogs(prev => [...prev, { type: 'error', text: data.message }])
              setError(data.message)
              setLoading(false)
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">添加新项目</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub 地址</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            autoFocus
            disabled={loading}
          />
          {repoName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">将保存到: C:\Myfiles\Codes\repos\{repoName}</p>
          )}

          {/* Terminal-style log output */}
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

          {error && !logs.length && <p className="text-sm text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" disabled={loading}>取消</button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '克隆中...' : '克隆并添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
