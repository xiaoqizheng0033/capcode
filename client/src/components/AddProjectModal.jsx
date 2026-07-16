import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ClipboardPaste, OctagonX } from 'lucide-react'
import { api } from '../api'

export default function AddProjectModal({ open, onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const logEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (!open) return null

  const repoName = url.split('/').pop()?.replace(/\.git$/, '') || ''

  function finishClone(message, type = 'error') {
    setLoading(false)
    if (message) {
      setLogs(prev => [...prev, { type, text: message }])
    }
    abortControllerRef.current = null
  }

  async function handleTerminate() {
    if (!loading) return
    try {
      if (url.trim()) {
        await api.cancelClone(url.trim())
      }
    } catch (err) {
      console.error(err)
    }
    abortControllerRef.current?.abort()
    finishClone('克隆已终止，未完成目录已清理', 'error')
  }

  async function handleClose() {
    if (loading) {
      await handleTerminate()
    }
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim() || loading) return
    setLoading(true)
    setError('')
    setLogs([])
    abortControllerRef.current = null

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/projects/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
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
              const progressLines = data.message.split('\n').filter(l => l.trim())
              setLogs(prev => {
                const next = [...prev]
                for (const line of progressLines) {
                  const text = line.trimEnd()
                  const isReceiving = text.startsWith('Receiving objects:')
                  const isResolving = text.startsWith('Resolving deltas:')
                  const isCompressing = text.startsWith('remote: Compressing')
                  if (isReceiving || isResolving || isCompressing) {
                    const key = isReceiving ? 'Receiving' : isResolving ? 'Resolving' : 'remoteCompress'
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
              setLogs(prev => [...prev, { type: 'success', text: '克隆完成' }])
              setLoading(false)
              abortControllerRef.current = null
              onAdded(data.project)
            } else if (eventType === 'cancelled') {
              finishClone(data.message || '克隆已终止，未完成目录已清理', 'error')
            } else if (eventType === 'error') {
              setLogs(prev => [...prev, { type: 'error', text: data.message }])
              setError(data.message)
              finishClone()
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      finishClone()
    }
  }

  const modal = (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">添加新项目</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">仓库地址</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git 或 https://gitee.com/user/repo.git"
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              autoFocus
              disabled={loading}
            />
            <button type="button" onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                if (text?.trim()) setUrl(text.trim())
              } catch {}
            }}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
              title="粘贴剪贴板地址"
              disabled={loading}
            >
              <ClipboardPaste size={16} />
            </button>
          </div>
          {repoName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">将保存到: C:\Myfiles\Codes\repos\{repoName}</p>
          )}

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
            {loading ? (
              <button
                type="button"
                onClick={handleTerminate}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                <OctagonX size={16} /> 终止
              </button>
            ) : (
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                取消
              </button>
            )}
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

  return createPortal(modal, document.body)
}
