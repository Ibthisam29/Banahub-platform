import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '../../hooks/useAuth';
import clsx from 'clsx';

const NAV_LINKS = [
  { label: 'Ecosystem', href: '/' },
  { label: 'Expansion', href: '/programs' },
  { label: 'Capital', href: '/mandates' },
  { label: 'Solutions', href: '#solutions' },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 glass border-b border-outline-variant/20">
      <div className="max-w-container mx-auto px-10 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-title-lg font-display font-semibold text-on-surface tracking-tight">
          BANAHub
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              to={href}
              className={clsx(
                'text-body-md font-sans transition-colors duration-150',
                location.pathname === href
                  ? 'text-on-surface font-semibold border-b-2 border-on-surface pb-0.5'
                  : 'text-on-surface/60 hover:text-on-surface'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-ghost text-sm">Dashboard</Link>
          ) : (
            <Link to="/login" className="nav-link">Login</Link>
          )}
          <Link to="/register" className="btn-primary text-sm">Apply Now</Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white/95 border-t border-outline-variant/20 px-6 py-4 flex flex-col gap-4 animate-in">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} to={href} className="text-body-lg font-sans text-on-surface" onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <div className="pt-2 flex gap-3 border-t border-outline-variant/20">
            <Link to="/login" className="btn-secondary flex-1 text-center">Login</Link>
            <Link to="/register" className="btn-primary flex-1 text-center">Apply Now</Link>
          </div>
        </div>
      )}
    </header>
  );
}
