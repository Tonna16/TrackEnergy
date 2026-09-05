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
import UsageHistory from './pages/UsageHistory'
import PrintableReport from './pages/PrintableReport'
import { useEffect } from 'react'
import { useAppContext } from './context/AppContext'
import { BACKEND_ENABLED } from './config/runtime'

function LocalFullStackFeature() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-black">
      <div className="mx-auto mt-16 max-w-lg rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold">Local full-stack feature</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Accounts and server-backed profiles are available when EnergyIQ is started in local full-stack mode.
          The public client demo stores appliance data only in this browser and does not contact a backend.
        </p>
        <a href="#/" className="mt-5 inline-block text-emerald-600 hover:underline">Return to the client demo</a>
      </div>
    </div>
  )
}

function DemoOnlyFeature() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-black">
      <div className="mx-auto mt-16 max-w-lg rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold">Local Demo feature</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Browser-local history entry and printable reports are available in the zero-cost Local Demo.
          Full-stack mode keeps history forecasting and PDF reports on the local Spring Boot/H2 server.
        </p>
        <a href="/" className="mt-5 inline-block text-emerald-600 hover:underline">Return to EnergyIQ</a>
      </div>
    </div>
  )
}

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
  <Route path="history" element={BACKEND_ENABLED ? <DemoOnlyFeature /> : <UsageHistory />} />
  <Route path="report" element={BACKEND_ENABLED ? <DemoOnlyFeature /> : <PrintableReport />} />

  {/* Protected pages (only logged-in users) */}
  <Route element={<ProtectedRoute />}>
    <Route path="profile" element={<ProfilePage />} />
  </Route>

  {/* Pages like add-appliance and edit-appliance are accessible by guests too */}
  <Route path="add-appliance" element={<ApplianceForm />} />
  <Route path="edit-appliance/:id" element={<ApplianceForm />} />
</Route>


      {/* Auth routes (login/signup) */}
      <Route path="/login" element={BACKEND_ENABLED ? <LoginPage /> : <LocalFullStackFeature />} />
      <Route path="/signup" element={BACKEND_ENABLED ? <SignupPage /> : <LocalFullStackFeature />} />
    </Routes>
  )
}

export default App
