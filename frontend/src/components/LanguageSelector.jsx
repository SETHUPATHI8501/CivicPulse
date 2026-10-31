import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector({ variant = 'pill' }) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  ];

  // Click-outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setIsOpen(false);
  };

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  if (variant === 'toggle') {
    return (
      <button
        type="button"
        onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-700 transition-colors shadow-sm focus-ring"
        title="Toggle English / தமிழ்"
        aria-label="Toggle language"
      >
        <Languages className="w-3.5 h-3.5 text-teal-600" />
        <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm focus-ring"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select language"
      >
        <Languages className="w-4 h-4 text-teal-600" />
        <span className="font-semibold">{currentLang.native}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 z-50 focus:outline-none py-1 animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors ${
                language === lang.code
                  ? 'bg-teal-50 text-teal-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              role="menuitem"
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium text-slate-900">{lang.native}</span>
                <span className="text-[10px] text-slate-400">{lang.label}</span>
              </div>
              {language === lang.code && <Check className="w-4 h-4 text-teal-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

