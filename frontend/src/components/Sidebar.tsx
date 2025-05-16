import  { Link, useLocation } from 'react-router-dom';
import { Home, Plus, Activity, BarChart2, Settings, X, Zap } from 'lucide-react';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', icon: Home, href: '/' },
    { name: 'Add Appliance', icon: Plus, href: '/add-appliance' },
    { name: 'Insights', icon: Activity, href: '/insights' },
    { name: 'Compare', icon: BarChart2, href: '/compare' },
    { name: 'Settings', icon: Settings, href: '/settings' },
  ];
  
  return (
    <>
      {/* Mobile sidebar backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setOpen(false)}
        ></div>
      )}
      
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform ease-in-out duration-300 md:translate-x-0 md:static md:h-screen ${
          open ? 'translate-x-0' : '-translate-x-full'
        } border-r border-gray-200 dark:border-gray-700`}
      >
        <div className="h-full flex flex-col">
          {/* Logo and close button */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">WattWatch</span>
            </Link>
            <button
              type="button"
              className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => setOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="mt-4 flex-1 space-y-1 px-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-2 py-3 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/30'
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* Energy usage summary */}
          <div className="p-4 mt-auto border-t border-gray-200 dark:border-gray-700">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Current Usage</h4>
              <div className="mt-1 flex items-center">
                <div className="text-2xl font-semibold text-gray-800 dark:text-white">3.2 kWh</div>
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 rounded">
                  Today
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                15% lower than yesterday
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
 