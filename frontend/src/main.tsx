// src/main.tsx
import './shim'
import { StrictMode } from 'react'
import { NotificationsProvider } from './context/NotificationsContext';
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import App from './App'
import './index.css'
import { AppProvider } from './context/AppContext'

// Point all axios requests at /api/*
axios.defaults.baseURL = '/api'

// Attach JWT if present
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
      <NotificationsProvider>
        <App />
        </NotificationsProvider>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
)
