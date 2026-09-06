import  { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import { useAppContext } from '../context/AppContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { authError, resolveAuthState } = useAppContext();
  const location = useLocation();
  
  return (
    <div className="app-shell relative flex h-screen overflow-hidden bg-gray-50 dark:bg-black">
      <div className="app-chrome pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-700/10" />
      <div className="app-chrome pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl dark:bg-indigo-700/10" />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div
        className={`flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="app-main flex-1 overflow-auto p-4 md:p-6 fade-in-up">
          {authError && !location.pathname.startsWith('/profile') && <div role="alert" className="mb-4 rounded bg-amber-50 p-3 text-amber-800">
            {authError.message}{' '}
            <button className="underline" onClick={() => void resolveAuthState()}>Retry</button>
          </div>}
          <Outlet />
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
 
