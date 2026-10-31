import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Menu,
  X,
  PlusCircle,
  Search,
  ShieldCheck,
  BarChart3,
  Home,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';
import Button from './Button';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const location = useLocation();

  const navLinks = [
    { to: '/', labelKey: 'home', defaultLabel: 'Home', icon: Home },
    { to: '/report', labelKey: 'reportComplaint', defaultLabel: 'Report Issue', icon: PlusCircle },
    { to: '/track', labelKey: 'trackComplaint', defaultLabel: 'Track Status', icon: Search },
    { to: '/analytics', labelKey: 'analytics', defaultLabel: 'Hotspot Analytics', icon: BarChart3 },
    { to: '/officer/dashboard', labelKey: 'officerPortal', defaultLabel: 'Officer Portal', icon: ShieldCheck },
  ];

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus-ring rounded-lg px-1 py-0.5"
            aria-label="CivicPulse AI Home"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-navy-900 to-teal-700 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Activity className="w-5 h-5 text-teal-300 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-navy-950 font-sans group-hover:text-teal-700 transition-colors">
                CivicPulse<span className="text-teal-600">.AI</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                Smart Community Platform
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                    ${
                      active
                        ? 'bg-teal-50 text-teal-800 border border-teal-200/70 font-bold'
                        : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100/70 border border-transparent'
                    }
                    focus-ring
                  `}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{t(item.labelKey, item.defaultLabel)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Language Selector & CTA */}
          <div className="hidden sm:flex items-center gap-3">
            <LanguageSelector />
            <Link to="/report">
              <Button variant="teal" size="sm" icon={PlusCircle}>
                {t('reportComplaint', 'Report Issue')}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu & Language Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSelector variant="toggle" />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-ring"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="px-4 pt-3 pb-4 space-y-1">
            {navLinks.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      active
                        ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                        : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{t(item.labelKey, item.defaultLabel)}</span>
                </Link>
              );
            })}

            <div className="pt-3 border-t border-slate-100">
              <Link to="/report" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="teal" size="md" icon={PlusCircle} fullWidth>
                  {t('reportComplaint', 'Report Issue')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

