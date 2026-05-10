import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'

function AppRoutes() {
  const location = useLocation()
  // Force remount ProjectDetail on every navigation to ensure fresh data
  const detailKey = useMemo(() => `${location.pathname}-${Date.now()}`, [location.key])
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:id" element={<ProjectDetail key={detailKey} />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
