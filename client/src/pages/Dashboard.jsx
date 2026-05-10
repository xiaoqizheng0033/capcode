import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, RefreshCw, Settings, Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { api } from '../api'
import ProjectCard from '../components/ProjectCard'
import CategoryGroup from '../components/CategoryGroup'
import AddProjectModal from '../components/AddProjectModal'

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ totalProjects: 0, updatedProjects: 0, todayUpdates: 0, lastCheckAt: null })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([api.getProjects(search), api.getStats()])
      setProjects(p)
      setStats(s)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadData()
    const timer = setTimeout(() => loadData(), 15000)
    return () => clearTimeout(timer)
  }, [loadData])

  async function handleScan() {
    try {
      await api.scanProjects()
      await loadData()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Repo Manager</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? '切换亮色主题' : '切换暗黑主题'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/settings" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><Settings size={20} /></Link>
        </div>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalProjects}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">总项目</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.updatedProjects}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">有更新</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.todayUpdates}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">今日更新次数</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {stats.lastCheckAt ? new Date(stats.lastCheckAt).toLocaleString() : '从未'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">上次检查</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          <Plus size={16} /> 添加项目
        </button>
        <button
          onClick={handleScan}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw size={16} /> 手动扫描
        </button>
        <button
          onClick={async () => {
            try {
              setLoading(true)
              await api.autoClassify()
              await loadData()
            } catch (err) {
              alert('智能分类失败: ' + err.message)
              setLoading(false)
            }
          }}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          智能分类
        </button>
        <button
          onClick={async () => {
            try {
              setLoading(true)
              await api.regenerateAllSummaries()
              await loadData()
            } catch (err) {
              alert('生成摘要失败: ' + err.message)
              setLoading(false)
            }
          }}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          生成摘要
        </button>
      </div>

      {/* Project grid grouped by category */}
      {loading ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-8">加载中...</p>
      ) : projects.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-8">暂无项目</p>
      ) : (
        (() => {
          const grouped = {}
          const uncategorized = []
          for (const p of projects) {
            if (p.category) {
              if (!grouped[p.category]) grouped[p.category] = []
              grouped[p.category].push(p)
            } else {
              uncategorized.push(p)
            }
          }
          const groups = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))
          return (
            <>
              {groups.map(([cat, projs]) => (
                <CategoryGroup key={cat} category={cat} projects={projs} />
              ))}
              {uncategorized.length > 0 && (
                <CategoryGroup key="uncategorized" category="未分类" projects={uncategorized} defaultOpen={projects.length === uncategorized.length} />
              )}
            </>
          )
        })()
      )}

      <AddProjectModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); loadData() }} />
    </div>
  )
}
