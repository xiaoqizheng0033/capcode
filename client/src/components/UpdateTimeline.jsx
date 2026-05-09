export default function UpdateTimeline({ updates }) {
  if (!updates || updates.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-4">暂无更新记录</p>
  }

  return (
    <div className="space-y-3">
      {updates.map(u => (
        <div key={u.id} className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {new Date(u.pull_time).toLocaleString()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              u.status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
              u.status === 'failed' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
              'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
              {u.status === 'success' ? `${u.commits_count} 个提交` :
               u.status === 'failed' ? '失败' : '无变化'}
            </span>
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
  )
}
