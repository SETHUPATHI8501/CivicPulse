import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    id,
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
    error,
    helperText,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    required = false,
    disabled = false,
    fullWidth = true,
    className = '',
    ...props
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 tracking-wide"
        >
          {label}
          {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative rounded-lg shadow-sm">
        {LeftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LeftIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            block w-full rounded-lg border text-sm transition-colors
            ${LeftIcon ? 'pl-9' : 'pl-3.5'}
            ${RightIcon || error ? 'pr-9' : 'pr-3.5'}
            py-2
            ${
              error
                ? 'border-rose-300 text-rose-900 placeholder-rose-300 focus:border-rose-500 focus:ring-rose-500'
                : 'border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500'
            }
            ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${className}
          `}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />

        {error && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <AlertCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
          </div>
        )}

        {!error && RightIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <RightIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </div>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-xs text-slate-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;

