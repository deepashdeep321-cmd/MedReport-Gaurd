import React from 'react';
import type { UiCopy } from '../i18n/translations';

export type AppView = 'overview' | 'upload' | 'summary' | 'confirm' | 'trends' | 'settings' | 'admin';

interface TopNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  copy: UiCopy;
}

export const TopNav: React.FC<TopNavProps> = ({ activeView, onNavigate, copy }) => {
  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'overview', label: copy.navOverview },
    { id: 'upload', label: copy.navUpload },
    { id: 'summary', label: copy.navSummary },
    { id: 'trends', label: copy.navTrends },
    { id: 'settings', label: copy.navSettings },
  ];

  const isActive = (id: AppView) => {
    if (id === 'summary' && activeView === 'confirm') return true;
    if (id === 'settings' && activeView === 'admin') return true;
    return activeView === id;
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 cursor-pointer"
        >
          {copy.brand}
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  active
                    ? 'text-teal-800 border-teal-700'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {copy.ctaUpload}
          </button>
        </div>
      </div>

      {/* Compact single-row mobile navigation (<= 15% viewport cap) */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center justify-around border-t border-slate-100 px-2 py-1.5 bg-white overflow-x-auto"
      >
        {navItems.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 rounded-md transition-colors ${
                active ? 'bg-teal-50 text-teal-800' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
