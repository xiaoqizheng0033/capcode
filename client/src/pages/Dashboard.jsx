import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, RefreshCw, Settings } from 'lucide-react'
import { api } from '../api'
import ProjectCard from '../components/ProjectCard'
import AddProjectModal from '../components/AddProjectModal'

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ totalProjects: 0, updatedProjects: 0, todayUpdates: 0, lastCheckAt: null })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

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
    // 启动后自动 pull 约 10s 后执行，延迟刷新获取最新结果
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
        <h1 className="text-2xl font-bold text-gray-900">Repo Manager</h1>
        <Link to="/settings" className="text-gray-400 hover:text-gray-600"><Settings size={20} /></Link>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.totalProjects}</div>
          <div className="text-sm text-gray-500">总项目</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-green-600">{stats.updatedProjects}</div>
          <div className="text-sm text-gray-500">有更新</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.todayUpdates}</div>
          <div className="text-sm text-gray-500">今日更新次数</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-sm font-medium text-gray-700">
            {stats.lastCheckAt ? new Date(stats.lastCheckAt).toLocaleString() : '从未'}
          </div>
          <div className="text-sm text-gray-500">上次检查</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
        >
          <RefreshCw size={16} /> 手动扫描
        </button>
      </div>

      {/* Project grid */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中...</p>
      ) : projects.length === 0 ? (
        <p className="text-center text-gray-400 py-8">暂无项目</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      <AddProjectModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdded={() => { setShowAddModal(false); loadData() }} />
    </div>
  )
}
