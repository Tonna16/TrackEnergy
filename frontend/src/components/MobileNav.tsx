import  { Link, useLocation } from 'react-router-dom';
import { Home, Plus, Activity, BarChart2, Settings } from 'lucide-react';

export default function MobileNav() {
  const location = useLocation();
  
  const navigation = [
    { name: 'Home', icon: Home, href: '/' },
    { name: 'Add', icon: Plus, href: '/add-appliance' },
    { name: 'Insights', icon: Activity, href: '/insights' },
    { name: 'Compare', icon: BarChart2, href: '/compare' },
    { name: 'Settings', icon: Settings, href: '/settings' },
  ];
  
  return (
       <div className="sm:hidden bg-white dark:bg-dark-bg border-t border-gray-200 dark:border-dark-border fixed bottom-0 left-0 right-0 z-10"> 
      <nav className="flex justify-around">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center pt-2 pb-1 ${
                isActive 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                                   : 'text-gray-500 dark:text-dark-textSecondary' 
              }`}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
 