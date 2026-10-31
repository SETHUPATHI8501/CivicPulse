import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ShieldCheck, HeartHandshake, PhoneCall, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-navy-950 text-slate-300 border-t border-slate-800/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Col 1: Platform Branding & Mission */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                CivicPulse<span className="text-teal-400">.AI</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              {t(
                'footerDesc',
                'CivicPulse AI is an automated municipal grievance redressal system leveraging artificial intelligence and geospatial intelligence for transparent governance.'
              )}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-teal-400 font-medium">
              <HeartHandshake className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span>{t('hackathonInfo', 'ARSW001 Hackathon Project • Team Alronclad • KSRIET')}</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {t('quickLinks', 'Quick Links')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="text-slate-400 hover:text-teal-300 transition-colors">
                  {t('home', 'Home')}
                </Link>
              </li>
              <li>
                <Link to="/report" className="text-slate-400 hover:text-teal-300 transition-colors">
                  {t('reportComplaint', 'Report Issue')}
                </Link>
              </li>
              <li>
                <Link to="/track" className="text-slate-400 hover:text-teal-300 transition-colors">
                  {t('trackComplaint', 'Track Status')}
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="text-slate-400 hover:text-teal-300 transition-colors">
                  {t('analytics', 'Hotspot Analytics')}
                </Link>
              </li>
              <li>
                <Link to="/officer/dashboard" className="text-slate-400 hover:text-teal-300 transition-colors">
                  {t('officerPortal', 'Officer Portal')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Municipal Support & Contacts */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {t('emergencyHelpline', 'Emergency Services')}
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Municipal Control: <strong>1913</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Water Board: <strong>044-4567-8900</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Police / Traffic: <strong>100 / 103</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                <span>Tamil Nadu e-Governance Portal</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Accessibility */}
        <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {t('copyright', 'CivicPulse AI. Municipal Civic Technology Platform.')}</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Citizen Charter</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

