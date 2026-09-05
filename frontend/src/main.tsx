// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

import { AppProvider } from './context/AppContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { BACKEND_ENABLED } from './config/runtime';

const Router = BACKEND_ENABLED ? BrowserRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AppProvider>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </AppProvider>
    </Router>
  </StrictMode>
);
