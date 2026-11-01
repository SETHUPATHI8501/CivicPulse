import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  Layers,
  Users,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Flame,
  Wrench,
  Siren,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import Button from '../components/Button';

export default function OfficerLayout({ children }) {
  const { officer, isAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/officer/login', { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-navy-900 text-white shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const mobileNavLinkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium transition-all ${
      isActive
        ? 'bg-navy-900 text-white shadow-sm'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand & Portal Badge */}
            <div className="flex items-center gap-6">
              <Link to="/officer/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 text-teal-400 flex items-center justify-center shadow-md shadow-navy-900/10 group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base tracking-tight text-navy-950 font-display">
                      CivicPulse <span className="text-teal-600">AI</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-navy-100 text-navy-800">
                      Operations
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Municipal Grievance Portal</p>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1.5 ml-4">
                <NavLink to="/officer/dashboard" className={navLinkClass}>
                  <Layers className="w-4 h-4" />
                  <span>{t('assignedComplaints', 'Complaints Queue')}</span>
                </NavLink>

                <NavLink to="/officer/worker" className={navLinkClass}>
                  <Wrench className="w-4 h-4" />
                  <span>{t('workerPortal', 'Field Worker')}</span>
                </NavLink>

                {officer?.role !== 'WORKER' && (
                  <NavLink to="/officer/emergency" className={navLinkClass}>
                    <Siren className="w-4 h-4 text-rose-500" />
                    <span>{t('emergencyCommand', 'SOS Command')}</span>
                  </NavLink>
                )}

                <NavLink to="/officer/analytics" className={navLinkClass}>
                  <Flame className="w-4 h-4" />
                  <span>{t('hotspotAnalytics', 'Hotspot Analytics')}</span>
                </NavLink>

                {isAdmin && (
                  <NavLink to="/officer/admin/officers" className={navLinkClass}>
                    <Users className="w-4 h-4" />
                    <span>{t('adminOfficerDir', 'Officer Directory')}</span>
                  </NavLink>
                )}
              </nav>
            </div>

            {/* Right: Officer Profile, Citizen Link, Language, Logout */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                title="Open Citizen Portal in new tab"
              >
                <span>{t('citizenPortal', 'Citizen Portal')}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <LanguageSelector variant="toggle" />

              <div className="h-6 w-px bg-slate-200" />

              {/* Officer Card */}
              {officer && (
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5">
                  <div className="w-8 h-8 rounded-lg bg-navy-900 text-teal-400 font-bold text-xs flex items-center justify-center uppercase shadow-2xs">
                    {officer.name ? officer.name.slice(0, 2) : 'OF'}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 leading-tight">
                        {officer.name}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isAdmin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {officer.role}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium block leading-tight truncate max-w-[150px]">
                      {officer.department}
                    </span>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200/80 focus-ring"
                title="Sign out of portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('logout', 'Sign Out')}</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center gap-2">
              <LanguageSelector variant="toggle" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus-ring"
                aria-label="Toggle Navigation"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
            {officer && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-navy-900 text-teal-400 font-bold text-sm flex items-center justify-center uppercase">
                  {officer.name ? officer.name.slice(0, 2) : 'OF'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{officer.name}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {officer.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{officer.department}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <NavLink
                to="/officer/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <Layers className="w-5 h-5 text-teal-600" />
                <span>{t('assignedComplaints', 'Complaints Queue')}</span>
              </NavLink>

              <NavLink
                to="/officer/worker"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <Wrench className="w-5 h-5 text-amber-600" />
                <span>{t('workerPortal', 'Field Worker Portal')}</span>
              </NavLink>

              {officer?.role !== 'WORKER' && (
                <NavLink
                  to="/officer/emergency"
                  onClick={() => setMobileMenuOpen(false)}
                  className={mobileNavLinkClass}
                >
                  <Siren className="w-5 h-5 text-rose-600" />
                  <span>{t('emergencyCommand', 'SOS Emergency Command')}</span>
                </NavLink>
              )}

              <NavLink
                to="/officer/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                <Flame className="w-5 h-5 text-teal-600" />
                <span>{t('hotspotAnalytics', 'Hotspot Analytics')}</span>
              </NavLink>

              {isAdmin && (
                <NavLink
                  to="/officer/admin/officers"
                  onClick={() => setMobileMenuOpen(false)}
                  className={mobileNavLinkClass}
                >
                  <Users className="w-5 h-5 text-teal-600" />
                  <span>{t('adminOfficerDir', 'Officer Directory')}</span>
                </NavLink>
              )}

              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-slate-400" />
                  <span>{t('citizenPortal', 'Citizen Portal')}</span>
                </span>
              </Link>
            </div>

            <div className="pt-2">
              <Button
                variant="danger"
                size="md"
                fullWidth
                icon={LogOut}
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                {t('logout', 'Sign Out')}
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Mini Admin Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© 2026 CivicPulse AI • Municipal Grievance Redressal System</p>
          <p className="text-slate-400">ARSW001 Hackathon • Team Alronclad • KSRIET</p>
        </div>
      </footer>
    </div>
  );
}
