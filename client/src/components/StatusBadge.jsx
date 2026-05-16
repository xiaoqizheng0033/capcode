export default function StatusBadge({ hasUpdates, lastPullAt }) {
  if (!lastPullAt) {
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">未检查</span>
  }

  const today = new Date().toISOString().slice(0, 10)
  const isToday = lastPullAt?.startsWith(today)

  if (hasUpdates && isToday) {
    return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">今日更新</span>
  }
  if (hasUpdates) {
    return <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">有更新</span>
  }
  return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">无更新</span>
}
