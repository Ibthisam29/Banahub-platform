import { Link } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuth';

interface TopBarProps {
  title?: string;
  navItems?: { label: string; href: string; active?: boolean }[];
  showSearch?: boolean;
  searchPlaceholder?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function AppTopBar({
  title,
  navItems,
  showSearch = false,
  searchPlaceholder = 'Search...',
  ctaLabel,
  ctaHref,
}: TopBarProps) {
  const { user } = useAuthStore();

  return (
    <header className="glass sticky top-0 z-40 border-b border-outline-variant/20 h-14 flex items-center px-6 gap-6">
      {/* Logo/Title */}
      {title && (
        <span className="text-title-lg font-display font-semibold text-on-surface mr-2">{title}</span>
      )}

      {/* Nav tabs */}
      {navItems && (
        <nav className="flex items-center gap-6 flex-1">
          {navItems.map(({ label, href, active }) => (
            <Link
              key={label}
              to={href}
              className={active
                ? 'text-body-md font-sans font-semibold text-on-surface border-b-2 border-on-surface pb-0.5'
                : 'text-body-md font-sans text-on-surface/60 hover:text-on-surface transition-colors'
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {/* Spacer */}
      {!navItems && <div className="flex-1" />}

      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="pl-8 pr-4 py-1.5 bg-surface-low rounded text-body-md font-sans text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 w-52"
          />
        </div>
      )}

      {/* CTA */}
      {ctaLabel && ctaHref && (
        <Link to={ctaHref} className="btn-primary text-sm">{ctaLabel}</Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 ml-auto">
        <button className="relative p-2 text-on-surface/60 hover:text-on-surface transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-secondary rounded-full" />
        </button>
        <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {user?.profile.avatar
            ? <img src={user.profile.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            : <User size={16} />
          }
        </button>
      </div>
    </header>
  );
}
