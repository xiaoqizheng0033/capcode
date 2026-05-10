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
        <Link to="/" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-md text-sm ${msg.includes('失败') ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
          {msg}
        </div>
      )}

      {/* Scan settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">扫描设置</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Repo 目录路径</label>
          <input
            type="text"
            defaultValue={config.repo_base_path}
            onBlur={e => handleSave('repo_base_path', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">检查间隔 (小时)</label>
          <input
            type="number"
            min="1"
            max="72"
            defaultValue={config.scan_interval_hours}
            onBlur={e => handleSave('scan_interval_hours', e.target.value)}
            className="w-32 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">修改后自动重启定时任务</p>
        </div>
      </div>

      {/* AI Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">AI 设置 (DeepSeek)</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
          <input
            type="text"
            defaultValue={config.ai_api_url || 'https://api.deepseek.com/v1/chat/completions'}
            onBlur={e => handleSave('ai_api_url', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
          <input
            type="password"
            defaultValue={config.ai_api_key || ''}
            onBlur={e => handleSave('ai_api_key', e.target.value)}
            placeholder="sk-..."
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={async () => {
              try {
                const result = await api.testAiConnection()
                handleResetMsg(result.message)
              } catch (err) {
                handleResetMsg('测试失败: ' + err.message)
              }
            }}
            className="mt-2 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            测试连接
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={async () => {
              try {
                const result = await api.regenerateAllSummaries()
                const successCount = result.results?.filter(r => r.status === 'success').length || 0
                handleResetMsg(`摘要生成完成: ${successCount}/${result.results?.length || 0} 成功`)
              } catch (err) {
                handleResetMsg('摘要生成失败: ' + err.message)
              }
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            重新生成所有摘要
          </button>
          <button
            onClick={async () => {
              try {
                const result = await api.autoClassify()
                handleResetMsg(`分类完成: ${result.classifications?.length || 0} 个项目已分类`)
              } catch (err) {
                handleResetMsg('分类失败: ' + err.message)
              }
            }}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            智能分类所有项目
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">数据库维护</h2>
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
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw size={14} className="inline mr-1" /> 重新扫描所有项目
          </button>
        </div>
      </div>
    </div>
  )
}
