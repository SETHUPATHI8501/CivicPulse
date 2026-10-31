import React from 'react';

export default function Spinner({ size = 'md', variant = 'teal', className = '', label = 'Loading...' }) {
  const sizeClasses = {
    xs: 'w-3 h-3 border-[1.5px]',
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-[2.5px]',
    xl: 'w-12 h-12 border-3',
  };

  const variantClasses = {
    primary: 'border-slate-200 border-t-navy-900',
    teal: 'border-teal-100 border-t-teal-600',
    white: 'border-white/30 border-t-white',
    slate: 'border-slate-200 border-t-slate-600',
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status">
      <div
        className={`
          ${sizeClasses[size] || sizeClasses.md}
          ${variantClasses[variant] || variantClasses.teal}
          rounded-full animate-spin
        `}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

