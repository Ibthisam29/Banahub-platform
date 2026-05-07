import { useState } from 'react';
import AppTopBar from '../components/layout/AppTopBar';
import { Shield, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

const MEMBERS = [
  { id: '1', name: 'Hassan Al-Zahrani', inst: 'Riyadh Family Office', tier: 'founding', status: 'Complete', fee: 'Paid', region: 'Gulf Region' },
  { id: '2', name: 'Chen Wei-Ting', inst: 'North Star Asset Mgmt', tier: 'standard', status: 'Manual Vetting', fee: 'Pending', region: 'North Asia' },
  { id: '3', name: 'Lin Dan', inst: 'Singapore Sovereign Fund', tier: 'founding', status: 'Compliance Flag', fee: 'Paid', region: 'SEA' },
  { id: '4', name: 'Ananya Gupta', inst: 'Mekong Venture Partners', tier: 'standard', status: 'Verified', fee: 'Paid', region: 'SEA' },
];

const TIER_CLS: Record<string, string> = {
  founding: 'bg-secondary/15 text-secondary',
  standard: 'bg-surface-high text-on-surface/70',
};

const STATUS_CLS: Record<string, string> = {
  'Complete': 'text-primary',
  'Manual Vetting': 'text-secondary',
  'Compliance Flag': 'text-error',
  'Verified': 'text-primary',
};

export default function AdminPage() {
  const [filters, setFilters] = useState({ region: 'All Regions', tier: 'All Tiers', status: 'Any Status' });

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <AppTopBar
        navItems={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'Memberships', href: '/admin', active: true },
          { label: 'Compliance', href: '#' },
          { label: 'Capital Flows', href: '#' },
        ]}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar - onboarding steps */}
        <aside className="w-52 flex-shrink-0 bg-surface-lowest border-r border-outline-variant/20 flex flex-col">
          <div className="p-5 border-b border-outline-variant/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-12 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold font-display">BH</span>
              </div>
            </div>
            <p className="text-title-lg font-display font-semibold text-on-surface mt-3">Onboarding</p>
            <p className="section-label mt-0.5">Institutional Access</p>
          </div>

          <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
            {[
              { label: 'Welcome', done: true },
              { label: 'Company Profile', done: true },
              { label: 'Expansion', done: true },
              { label: 'Programs', done: true },
              { label: 'Vetting', active: true },
              { label: 'Confirmation', done: false },
            ].map(({ label, done, active }) => (
              <div key={label} className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded text-body-md font-sans transition-all duration-150',
                active ? 'bg-primary text-white' : done ? 'text-on-surface/70' : 'text-on-surface/40'
              )}>
                <Shield size={14} className={active ? 'text-white' : done ? 'text-primary' : 'text-outline'} />
                {label}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-outline-variant/20">
            <button className="btn-primary w-full text-sm">Save Progress</button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-6">
            <h1 className="font-display font-semibold text-headline-lg text-on-surface mb-1">Membership Governance</h1>
            <p className="text-body-md font-sans text-on-surface/60">Oversee institutional relationships and manual verification queues.</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-5 mb-8">
            <div className="metric-card">
              <p className="section-label mb-2">Total Members</p>
              <div className="flex items-baseline gap-2">
                <p className="font-display font-semibold text-5xl text-on-surface">1,284</p>
                <span className="badge-emerald">+12%</span>
              </div>
              <div className="flex gap-6 mt-3">
                <div><p className="section-label">Founding</p><p className="text-body-lg font-sans font-semibold text-on-surface">412</p></div>
                <div><p className="section-label">Standard</p><p className="text-body-lg font-sans font-semibold text-on-surface">872</p></div>
              </div>
            </div>
            <div className="metric-card">
              <p className="section-label mb-2">Annual Recurring Revenue (ARR)</p>
              <div className="flex items-baseline gap-2">
                <p className="font-display font-semibold text-5xl text-on-surface">$4.2M</p>
                <span className="badge badge-emerald">Active</span>
              </div>
              <p className="text-body-md font-sans text-error mt-3">Fees Outstanding <span className="font-semibold">$184k</span></p>
            </div>
            <div className="metric-card">
              <p className="section-label mb-2">Pending Verifications</p>
              <div className="flex items-baseline gap-2">
                <p className="font-display font-semibold text-5xl text-on-surface">28</p>
                <span className="badge bg-secondary/15 text-secondary">Priority</span>
              </div>
              <div className="flex gap-6 mt-3">
                <div><p className="section-label">Avg. Wait Time</p><p className="text-body-lg font-sans font-semibold text-on-surface">1.4 Days</p></div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            {Object.entries(filters).map(([key, val]) => (
              <div key={key} className="flex-1">
                <p className="section-label mb-1.5">{key === 'tier' ? 'Membership Tier' : key === 'status' ? 'Vetting Status' : 'Region'}</p>
                <select
                  className="input-box w-full"
                  value={val}
                  onChange={(e) => setFilters(f => ({ ...f, [key]: e.target.value }))}
                >
                  <option>{val}</option>
                </select>
              </div>
            ))}
            <div className="flex items-end">
              <button className="btn-primary">Apply Filters</button>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  {['Name & Institution', 'Tier', 'Onboarding', 'Fee Status', 'Region', ''].map((h) => (
                    <th key={h} className="section-label text-left px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((m) => (
                  <tr key={m.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-low/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-body-md font-sans font-semibold text-on-surface">{m.name}</p>
                      <p className="text-label-caps text-outline">{m.inst}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx('badge text-label-caps capitalize', TIER_CLS[m.tier])}>{m.tier}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                          m.status === 'Compliance Flag' ? 'bg-error' :
                          m.status === 'Manual Vetting' ? 'bg-secondary' : 'bg-primary'
                        )} />
                        <span className={clsx('text-body-md font-sans font-semibold', STATUS_CLS[m.status])}>{m.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={clsx('text-body-md font-sans font-semibold',
                        m.fee === 'Pending' ? 'text-secondary' : 'text-on-surface'
                      )}>{m.fee}</span>
                    </td>
                    <td className="px-5 py-4 text-body-md font-sans text-on-surface/70">{m.region}</td>
                    <td className="px-5 py-4">
                      <button className="text-outline hover:text-on-surface transition-colors">···</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant/20">
              <p className="text-body-md font-sans text-outline">Showing 4 of 1,284 members</p>
              <div className="flex items-center gap-2">
                <button className="text-body-md font-sans text-outline hover:text-on-surface">Previous</button>
                {[1, 2, 3].map((p) => (
                  <button key={p} className={clsx(
                    'w-8 h-8 rounded text-body-md font-sans',
                    p === 1 ? 'bg-on-surface text-surface-lowest' : 'text-on-surface hover:bg-surface-low'
                  )}>{p}</button>
                ))}
                <button className="text-body-md font-sans text-outline hover:text-on-surface">Next</button>
              </div>
            </div>
          </div>
        </main>

        {/* Right panel - Lora AI */}
        <aside className="w-72 flex-shrink-0 border-l border-outline-variant/20 p-5 overflow-y-auto">
          {/* Lora header */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant/20">
            <div className="w-10 h-10 bg-surface-high rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-body-md font-sans font-semibold text-on-surface">Lora</p>
              <p className="section-label">Membership Assistant</p>
            </div>
          </div>

          {/* Priority Queue */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Priority Queue</p>
              <span className="badge badge-navy">3 Actionable</span>
            </div>
            <div className="card p-4 mb-3">
              <div className="flex items-start gap-2 mb-3">
                <div className="w-6 h-6 bg-surface-high rounded flex-shrink-0 flex items-center justify-center mt-0.5">
                  <span className="text-[8px] font-bold text-on-surface/40">CW</span>
                </div>
                <div>
                  <p className="text-body-md font-sans font-semibold text-on-surface text-sm">Chen Wei-Ting</p>
                  <p className="text-body-md font-sans text-on-surface/60 text-xs mt-0.5">"Waiting for manual ID verification."</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 border-2 border-outline-variant rounded text-label-caps font-sans text-on-surface hover:bg-surface-low transition-colors">Verify</button>
                <button className="flex-1 py-1.5 border-2 border-outline-variant rounded text-label-caps font-sans text-on-surface hover:bg-surface-low transition-colors">Flag</button>
              </div>
            </div>

            {/* Compliance alert */}
            <div className="card border-error/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-error flex-shrink-0" />
                <span className="text-body-md font-sans font-semibold text-error text-sm">Compliance Alert</span>
              </div>
              <p className="text-body-md font-sans text-on-surface/70 text-xs mb-3">Lin Dan: SANCTIONS WATCHLIST MATCH</p>
              <button className="w-full py-2 bg-error text-white text-label-caps font-sans rounded hover:bg-error/90 transition-colors">
                Review Case
              </button>
            </div>
          </div>

          {/* Smart Insights */}
          <div className="mb-5">
            <p className="section-label mb-3">Smart Insights</p>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-primary" />
                <span className="text-body-md font-sans font-semibold text-on-surface text-sm">Upgrade Opportunity:</span>
              </div>
              <p className="text-body-md font-sans text-on-surface/70 text-xs mb-3">
                4 members in the Gulf region have exceeded transactional thresholds and are eligible for <strong>Founding Institutional Tier</strong>.
              </p>
              <button className="flex items-center gap-1.5 text-label-caps font-sans text-primary hover:underline">
                Generate Upgrade Proposals <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <p className="section-label mb-3">Recent Activity</p>
            {[
              { actor: 'System', msg: 'Fee processed for Riyadh Family Office.' },
              { actor: 'Hassan A.', msg: 'Updated KYC documents.' },
              { actor: 'System', msg: 'New application from Jakarta Capital.' },
            ].map(({ actor, msg }, i) => (
              <div key={i} className="flex gap-2 mb-3 last:mb-0">
                <span className="w-1.5 h-1.5 rounded-full bg-outline mt-2 flex-shrink-0" />
                <p className="text-body-md font-sans text-on-surface/70 text-sm">
                  <span className="font-semibold text-on-surface">{actor}:</span> {msg}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
