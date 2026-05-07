import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Target, Briefcase, Globe, Settings,
  HelpCircle, LogOut, Plus, Shield
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Strategy', href: '/mandates', icon: Target },
  { label: 'Network', href: '/network', icon: Globe },
  { label: 'Capital', href: '/portfolio', icon: Briefcase },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  title?: string;
  subtitle?: string;
}

export default function AppSidebar({ title = 'Institutional OS', subtitle = 'PORTFOLIO DISCOVERY' }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-52 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-surface-lowest border-r border-outline-variant/30 overflow-y-auto">
      {/* Brand */}
      <div className="p-5 border-b border-outline-variant/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold font-display">B</span>
          </div>
          <span className="text-label-caps font-sans text-on-surface tracking-widest">BANAHUB</span>
        </div>
        <p className="text-title-lg font-display font-semibold text-on-surface mt-3">{title}</p>
        <p className="section-label mt-0.5">{subtitle}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <Link
              key={label}
              to={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-sans transition-all duration-150',
                active
                  ? 'bg-primary text-white'
                  : 'text-on-surface/60 hover:bg-surface-low hover:text-on-surface'
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Admin link */}
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-sans transition-all duration-150',
              location.pathname.startsWith('/admin')
                ? 'bg-primary text-white'
                : 'text-on-surface/60 hover:bg-surface-low hover:text-on-surface'
            )}
          >
            <Shield size={16} />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      {/* CTA */}
      <div className="p-4 border-t border-outline-variant/20">
        <button className="btn-primary w-full flex items-center justify-center gap-2 mb-4">
          <Plus size={14} />
          New Expansion
        </button>

        <div className="flex flex-col gap-1">
          <button className="flex items-center gap-3 px-3 py-2 rounded text-body-md font-sans text-on-surface/50 hover:text-on-surface hover:bg-surface-low transition-all duration-150">
            <HelpCircle size={14} />
            Support
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded text-body-md font-sans text-on-surface/50 hover:text-on-surface hover:bg-surface-low transition-all duration-150"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
