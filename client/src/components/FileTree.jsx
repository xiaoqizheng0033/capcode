import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { api } from '../api'

export default function FileTree({ projectId, selectedFile, onSelect }) {
  const [tree, setTree] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [allExpanded, setAllExpanded] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getFileTree(projectId).then(data => {
      setTree(data.tree)
      autoExpand(data.tree)
    }).catch(console.error).finally(() => setLoading(false))
  }, [projectId])

  function autoExpand(nodes) {
    const exp = {}
    function walk(arr) {
      arr.forEach(d => { if (d.type === 'dir') { exp[d.name] = true; walk(d.children || []) } })
    }
    walk(nodes)
    setExpanded(exp)
    setAllExpanded(true)
  }

  function toggleDir(name) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function expandAll() {
    autoExpand(tree)
  }

  function collapseAll() {
    setExpanded({})
    setAllExpanded(false)
  }

  function renderNode(node, depth = 0) {
    if (node.type === 'dir') {
      const open = expanded[node.name]
      return (
        <div key={node.name}>
          <button
            onClick={() => toggleDir(node.name)}
            className="w-full flex items-center gap-1 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open ? <FolderOpen size={12} className="text-yellow-500" /> : <Folder size={12} className="text-yellow-600" />}
            <span className="truncate">{node.name}</span>
          </button>
          {open && node.children?.map(child => renderNode(child, depth + 1))}
        </div>
      )
    }
    const active = selectedFile === node.path
    return (
      <button
        key={node.path}
        onClick={() => onSelect(node.path)}
        className={`w-full flex items-center gap-1 px-2 py-0.5 text-xs text-left transition-colors ${
          active
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <File size={12} className="flex-shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.lines > 0 && <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{node.lines}行</span>}
      </button>
    )
  }

  if (loading) return <div className="p-3 text-xs text-gray-400">加载文件树...</div>
  if (!tree || tree.length === 0) return <div className="p-3 text-xs text-gray-400">无源码文件</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-2 py-1 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase">文件</span>
        <button onClick={allExpanded ? collapseAll : expandAll}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title={allExpanded ? '全部折叠' : '全部展开'}>
          {allExpanded ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
        </button>
      </div>
      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">{tree.map(node => renderNode(node))}</div>
    </div>
  )
}
