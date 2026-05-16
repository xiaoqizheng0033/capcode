import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import LearnStudio from './pages/LearnStudio'

function AppRoutes() {
  const location = useLocation()
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:id" element={<ProjectDetail key={location.key} />} />
      <Route path="/project/:id/learn" element={<LearnStudio />} />
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