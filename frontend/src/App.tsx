// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ApplianceForm from './components/ApplianceForm'
import Compare from './pages/Compare'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import { useEffect } from 'react'
import { useAppContext } from './context/AppContext'

function App() {
  const { settings } = useAppContext()

  // Sync dark mode setting with HTML <html> tag
  useEffect(() => {
    const html = document.documentElement
    if (settings.darkMode) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [settings.darkMode])

  return (
    <Routes>
    {/* Public pages - guests + users */}
<Route element={<Layout />}>
  <Route index element={<Dashboard />} />
  <Route path="settings" element={<Settings />} />

  <Route path="compare" element={<Compare />} />
  <Route path="insights" element={<Insights />} />

  {/* Protected pages (only logged-in users) */}
  <Route element={<ProtectedRoute />}>
    <Route path="profile" element={<ProfilePage />} />
  </Route>

  {/* Pages like add-appliance and edit-appliance are accessible by guests too */}
  <Route path="add-appliance" element={<ApplianceForm />} />
  <Route path="edit-appliance/:id" element={<ApplianceForm />} />
</Route>


      {/* Auth routes (login/signup) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
  )
}

export default App
