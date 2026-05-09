export default function StatusBadge({ hasUpdates, lastPullAt }) {
  if (!lastPullAt) {
    return <span className="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">未检查</span>
  }
  return hasUpdates ? (
    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">有更新</span>
  ) : (
    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">无更新</span>
  )
}
