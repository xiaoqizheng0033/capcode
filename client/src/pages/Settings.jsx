import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { api } from '../api'

export default function Settings() {
  const [config, setConfig] = useState({ scan_interval_hours: '6', repo_base_path: 'C:\\Myfiles\\Codes\\repos' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.getConfig().then(setConfig).catch(console.error)
  }, [])

  async function handleSave(key, value) {
    setMsg('')
    try {
      await api.updateConfig(key, value)
      setMsg('保存成功')
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setMsg('保存失败: ' + err.message)
    }
  }

  function handleResetMsg(msg) {
    setMsg(msg)
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold text-gray-900">设置</h1>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {msg}
        </div>
      )}

      {/* Scan settings */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">扫描设置</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Repo 目录路径</label>
          <input
            type="text"
            defaultValue={config.repo_base_path}
            onBlur={e => handleSave('repo_base_path', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">检查间隔 (小时)</label>
          <input
            type="number"
            min="1"
            max="72"
            defaultValue={config.scan_interval_hours}
            onBlur={e => handleSave('scan_interval_hours', e.target.value)}
            className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">修改后自动重启定时任务</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="font-semibold text-gray-900 mb-4">数据库维护</h2>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              try {
                const result = await api.scanProjects()
                handleResetMsg(`扫描完成: 新增 ${result.added?.length || 0}, 更新 ${result.updated?.length || 0}, 移除 ${result.removed?.length || 0}`)
              } catch (err) {
                handleResetMsg('扫描失败: ' + err.message)
              }
            }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={14} className="inline mr-1" /> 重新扫描所有项目
          </button>
        </div>
      </div>
    </div>
  )
}
