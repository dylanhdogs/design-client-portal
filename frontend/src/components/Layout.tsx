import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, LogOut } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-gray-900 text-white flex flex-col md:min-h-screen">
        <div className="p-4 md:p-6 border-b border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <Logo size="sm" />
            <NotificationBell />
          </div>
        </div>

        <nav className="flex md:flex-1 gap-2 overflow-x-auto p-3 md:p-4 md:block md:space-y-1">
          <Link
            to="/"
            className={`flex shrink-0 items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg transition-colors ${
              isActive('/') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/clients"
            className={`flex shrink-0 items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg transition-colors ${
              isActive('/clients') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Clients</span>
          </Link>
        </nav>

        <div className="p-3 md:p-4 border-t border-gray-800">
          <div className="hidden md:flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center md:justify-start gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
