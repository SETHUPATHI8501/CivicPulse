import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-ring disabled:opacity-60 disabled:cursor-not-allowed select-none';

  const variants = {
    primary: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 shadow-sm border border-transparent',
    teal: 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm border border-transparent',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-transparent',
    outline: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 shadow-sm',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm border border-transparent',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 border border-transparent',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-4 py-2 gap-2 font-medium',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isButtonDisabled}
      onClick={onClick}
      aria-busy={isLoading}
      className={`
        ${baseStyles}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 flex-shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 flex-shrink-0" />}
        </>
      )}
    </button>
  );
}

