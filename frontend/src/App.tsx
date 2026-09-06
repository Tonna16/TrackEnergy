// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { lazy, Suspense, useEffect } from 'react'
import { useAppContext } from './context/AppContext'
import { BACKEND_ENABLED } from './config/runtime'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ApplianceForm = lazy(() => import('./components/ApplianceForm'))
const Compare = lazy(() => import('./pages/Compare'))
const Insights = lazy(() => import('./pages/Insights'))
const Settings = lazy(() => import('./pages/Settings'))
const UsageHistory = lazy(() => import('./pages/UsageHistory'))
const PrintableReport = lazy(() => import('./pages/PrintableReport'))
const LoginPage = BACKEND_ENABLED ? lazy(() => import('./pages/LoginPage')) : LocalFullStackFeature
const SignupPage = BACKEND_ENABLED ? lazy(() => import('./pages/SignupPage')) : LocalFullStackFeature
const ProfilePage = BACKEND_ENABLED ? lazy(() => import('./pages/ProfilePage')) : LocalFullStackFeature
const ProtectedRoute = BACKEND_ENABLED ? lazy(() => import('./components/ProtectedRoute')) : LocalFullStackFeature

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
        <h1 className="text-xl font-semibold">Server history forecast (API-only)</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Browser-local history entry and printable reports are available in the zero-cost Local Demo.
          Full-stack history must be entered through the authenticated local API; this mode has no Usage History editor.
          The forecast chart can read those server records. Browser-local demo history is not synchronized to the server.
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
    <Suspense fallback={<div role="status" className="p-6">Loading page…</div>}>
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
    </Suspense>
  )
}

export default App
