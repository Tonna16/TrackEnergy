import  { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
       <div className="flex h-screen bg-gray-50 dark:bg-black"> 
      {/* Sidebar for desktop */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
        
        {/* Mobile navigation */}
        <MobileNav />
      </div>
    </div>
  );
}
 