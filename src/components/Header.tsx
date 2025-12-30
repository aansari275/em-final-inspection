import { Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, List, Settings } from 'lucide-react';

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: ClipboardCheck, label: 'New Inspection' },
    { path: '/list', icon: List, label: 'Inspections' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Eastern Mills</h1>
            <p className="text-sm text-gray-500">Final Inspection Report</p>
          </div>
          <nav className="flex gap-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
