import { Link } from 'react-router-dom';
import { Share2, Mail } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="bg-surface border-t border-outline-variant/20 pt-12 pb-8">
      <div className="max-w-container mx-auto px-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div>
            <p className="text-headline-md font-display font-semibold text-on-surface mb-2">BANAHub</p>
            <p className="text-body-md font-sans text-on-surface/60 leading-relaxed">
              © 2024 BANAHub. Institutional Cross-Border Excellence.
            </p>
          </div>

          {/* Regions */}
          <div>
            <p className="section-label mb-4">Regions</p>
            {['Singapore HQ', 'SEA Gateway', 'Asia North', 'Gulf Region'].map((r) => (
              <p key={r} className="text-body-md font-sans text-on-surface/60 mb-2 hover:text-on-surface transition-colors cursor-pointer">{r}</p>
            ))}
          </div>

          {/* Governance */}
          <div>
            <p className="section-label mb-4">Governance</p>
            {['Privacy', 'Compliance', 'Transparency'].map((g) => (
              <Link key={g} to="#" className="block text-body-md font-sans text-on-surface/60 mb-2 hover:text-on-surface transition-colors">{g}</Link>
            ))}
          </div>

          {/* Connect */}
          <div>
            <p className="section-label mb-4">Connect</p>
            <div className="flex gap-3">
              <button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center text-on-surface/60 hover:text-on-surface hover:border-outline transition-colors">
                <Share2 size={14} />
              </button>
              <button className="w-8 h-8 rounded border border-outline-variant flex items-center justify-center text-on-surface/60 hover:text-on-surface hover:border-outline transition-colors">
                <Mail size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
