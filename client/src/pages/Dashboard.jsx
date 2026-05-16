import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, RefreshCw, Settings, Sun, Moon, X, Check, ChevronsDownUp, ChevronsUpDown, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { api } from '../api'
import ProjectCard from '../components/ProjectCard'
import CategoryGroup from '../components/CategoryGroup'
import CatLogo from '../components/CatLogo'
import AddProjectModal from '../components/AddProjectModal'

const categoryColors = {
  '量化交易': { bar: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400' },
  'AI Agent': { bar: 'border-l-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/20', text: 'text-violet-700 dark:text-violet-400' },
  '大模型应用': { bar: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20', text: 'text-blue-700 dark:text-blue-400' },
  '开发工具': { bar: 'border-l-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-700 dark:text-orange-400' },
  '数据分析': { bar: 'border-l-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/20', text: 'text-cyan-700 dark:text-cyan-400' },
  'Web框架': { bar: 'border-l-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/20', text: 'text-pink-700 dark:text-pink-400' },
  '自动化工具': { bar: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400' },
  '教育学习': { bar: 'border-l-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/20', text: 'text-teal-700 dark:text-teal-400' },
  '其他': { bar: 'border-l-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/30', text: 'text-gray-600 dark:text-gray-400' },
  '未分类': { bar: 'border-l-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/20', text: 'text-gray-500 dark:text-gray-400' },
}

function getColor(tag) {
  return categoryColors[tag] || categoryColors['其他']
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ totalProjects: 0, updatedProjects: 0, todayUpdates: 0, lastCheckAt: null })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [summaryResults, setSummaryResults] = useState(null)
  const [globalExpand, setGlobalExpand] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [allTags, setAllTags] = useState([])
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

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { api.getTags().then(setAllTags).catch(() => {}) }, [projects])

  function showStatus(msg) {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(''), 4000)
  }

  async function handleScan() {
    try {
      showStatus('扫描中...')
      await api.scanProjects()
      await loadData()
      showStatus('扫描完成')
    } catch (err) { showStatus('扫描失败: ' + err.message) }
  }

  function parseTags(p) {
    try { return JSON.parse(p.tags || '[]') } catch { return [] }
  }

  const filteredProjects = useMemo(() => {
    if (!selectedTag) return projects
    if (selectedTag === '__has_updates') return projects.filter(p => p.has_updates)
    return projects.filter(p => parseTags(p).includes(selectedTag))
  }, [projects, selectedTag])

  const projectGroups = useMemo(() => {
    if (!filteredProjects) return { grouped: [], uncategorized: [] }
    if (selectedTag) return { grouped: [], uncategorized: filteredProjects }
    const grouped = {}
    const uncategorized = []
    for (const p of filteredProjects) {
      const tags = parseTags(p)
      if (tags.length > 0) {
        const mainTag = tags[0]
        if (!grouped[mainTag]) grouped[mainTag] = []
        grouped[mainTag].push(p)
      } else { uncategorized.push(p) }
    }
    return {
      grouped: Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])),
      uncategorized,
    }
  }, [filteredProjects, selectedTag])

  const updatedCount = projects.filter(p => p.has_updates).length

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar — fixed */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          title={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CatLogo size={24} />
          CapCode
        </h1>
        <div className="flex-1" />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={theme === 'dark' ? '切换亮色主题' : '切换暗黑主题'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/settings" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><Settings size={20} /></Link>
      </header>

      {/* Body — sidebar + content, fills remaining height */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — fixed */}
        <div className={`${sidebarOpen ? 'w-52' : 'w-0'} flex-shrink-0 overflow-hidden transition-all duration-200`}>
          <div className="w-52 h-full flex flex-col border-r border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">标签筛选</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <button
                onClick={() => setSelectedTag(null)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${selectedTag === null ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <span>全部</span>
                <span className="text-xs text-gray-400">{projects.length}</span>
              </button>
              <button
                onClick={() => setSelectedTag(selectedTag === '__has_updates' ? null : '__has_updates')}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${selectedTag === '__has_updates' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
                  有更新
                </span>
                <span className="text-xs text-gray-400">{updatedCount}</span>
              </button>
              {allTags.map(tag => {
                const color = getColor(tag.name)
                const active = selectedTag === tag.name
                return (
                  <button
                    key={tag.name}
                    onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${active ? `${color.bg} ${color.text} font-semibold` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.bar.replace('border-l-', 'bg-')}`} />
                      {tag.name}
                    </span>
                    <span className="text-xs text-gray-400">{tag.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main content — scrolls */}
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="px-6 py-4">

            {/* Stats cards */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.totalProjects}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">总项目</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.updatedProjects}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">有更新</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.todayUpdates}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">今日更新</div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {stats.lastCheckAt ? new Date(stats.lastCheckAt).toLocaleString() : '从未'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">上次检查</div>
              </div>
            </div>

            {/* Status bar */}
            {statusMsg && (
              <div className="mb-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {statusMsg}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex-1 relative min-w-[160px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索项目..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"><Plus size={16} /> 添加项目</button>
              <button onClick={handleScan} className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"><RefreshCw size={16} /> 扫描</button>
              <button onClick={async () => { try { showStatus('正在智能分类...'); const r = await api.autoClassify(); await loadData(); showStatus(`分类完成: ${r.classifications?.length || 0} 个项目`) } catch (err) { showStatus('分类失败: ' + err.message) } }} className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">智能分类</button>
              {!selectedTag && selectedTag !== '__has_updates' && (
                <button onClick={() => setGlobalExpand(globalExpand === true ? false : true)} className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                  {globalExpand === true ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
                  {globalExpand === true ? '全部折叠' : '全部展开'}
                </button>
              )}
              <button onClick={async () => { try { showStatus('正在生成摘要...'); setSummaryResults(null); const r = await api.regenerateAllSummaries(); setSummaryResults(r.results || []); await loadData(); showStatus(`摘要完成: ${r.results?.filter(x => x.status === 'success').length || 0}/${r.results?.length || 0}`) } catch (err) { showStatus('摘要失败: ' + err.message) } }} className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">生成摘要</button>
            </div>

            {/* Summary results */}
            {summaryResults && (
              <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">摘要生成结果</h3>
                  <button onClick={() => setSummaryResults(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500"><X size={14} /></button>
                </div>
                <div className="max-h-64 overflow-y-auto text-xs">
                  {summaryResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 py-1 ${r.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      <span className="text-gray-400 dark:text-gray-500 w-5 text-right">{i + 1}.</span>
                      <span>{r.name}</span>
                      {r.status === 'success' ? <Check size={12} /> : <X size={12} />}
                      {r.status === 'failed' && <span className="text-red-400">- {r.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project grid */}
            {loading ? (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">加载中...</p>
            ) : filteredProjects.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">{selectedTag ? '该标签下暂无项目' : '暂无项目'}</p>
            ) : selectedTag ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            ) : (
              <>
                {projectGroups.uncategorized.length > 0 && (
                  <CategoryGroup key="uncategorized" category="未分类" projects={projectGroups.uncategorized} defaultOpen={filteredProjects.length === projectGroups.uncategorized.length} forceOpen={globalExpand} />
                )}
                {projectGroups.grouped.map(([cat, projs]) => (
                  <CategoryGroup key={cat} category={cat} projects={projs} forceOpen={globalExpand} />
                ))}
              </>
            )}

            <AddProjectModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdded={(project) => { setProjects(prev => [...prev, project]); setStats(s => ({ ...s, totalProjects: s.totalProjects + 1 })) }} />
          </div>
        </div>
      </div>
    </div>
  )
}
