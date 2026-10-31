import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout({
  children,
  pageTitle,
  subtitle,
  actions,
  maxWidth = 'max-w-7xl',
  className = '',
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-teal-500 selection:text-white">
      {/* Universal Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${className}`}>
        {/* Optional Page Header */}
        {(pageTitle || actions) && (
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              {pageTitle && (
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-navy-950">
                  {pageTitle}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        )}

        {children}
      </main>

      {/* Universal Footer */}
      <Footer />
    </div>
  );
}

