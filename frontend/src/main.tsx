// src/main.tsx
import './shim'
import { StrictMode } from 'react'
import { NotificationsProvider } from './context/NotificationsContext';
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AppProvider } from './context/AppContext'

// Point all axios requests at /api/*

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
