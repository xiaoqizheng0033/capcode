import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Trash2 } from 'lucide-react'

export default function UpdateTimeline({ updates, release, onDelete }) {
  const [deleting, setDeleting] = useState(null)

  if (!updates || updates.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-4">暂无更新记录</p>
  }

  async function handleDelete(u) {
    if (!confirm('确认删除这条更新记录？')) return
    setDeleting(u.id)
    try {
      await onDelete(u.id)
    } catch (err) {
      alert('删除失败: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800">
        {release === undefined ? (
          <div className="px-4 py-4 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-xs">加载 Release 信息中...</p>
          </div>
        ) : release === null ? (
          <div className="px-4 py-6 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">作者很懒，没有创建 Release 😬</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{release.name}</span>
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">Latest</span>
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-500 mt-0.5">
                {release.tag_name}
                {release.published_at && <span className="ml-3">{new Date(release.published_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="px-4 py-3 markdown-body text-sm text-gray-700 dark:text-gray-300 max-h-[600px] overflow-y-auto">
              {release.body ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {release.body}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">作者很懒，没有写更新笔记 😬</p>
              )}
            </div>
          </>
        )}
      </div>
      <div className="space-y-3">
        {updates.map(u => (
          <div key={u.id} className="border border-gray-200 dark:border-gray-700 rounded-md p-3 group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {new Date(u.pull_time).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  u.status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                  u.status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {u.status === 'success' ? `${u.commits_count} 个提交` :
                   u.status === 'failed' ? '失败' : '无变化'}
                </span>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={deleting === u.id}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {u.status === 'success' && u.commit_log.map((c, i) => (
              <div key={i} className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2 border-l-2 border-gray-200 dark:border-gray-600">
                <span className="font-mono text-gray-400 dark:text-gray-500">{c.hash?.substring(0, 7)}</span> {c.message}
              </div>
            ))}
            {u.status === 'failed' && u.error_msg && (
              <p className="text-xs text-red-500 mt-1">{u.error_msg}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
