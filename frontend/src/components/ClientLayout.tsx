import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, MessageSquare, LogOut } from 'lucide-react';
import Logo from './Logo';

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-6 border-b border-blue-800">
          <Logo />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/my-project"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/my-project') ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-800'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>My Project</span>
          </Link>
          <Link
            to="/my-documents"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/my-documents') ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-800'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span>My Documents</span>
          </Link>
          <Link
            to="/my-communications"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive('/my-communications') ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-800'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span>Communications</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-blue-300 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-100 hover:bg-blue-800 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
