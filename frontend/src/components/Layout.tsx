import  { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div
        className={`flex-1 flex flex-col overflow-hidden transition-[margin] duration-300 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
 
