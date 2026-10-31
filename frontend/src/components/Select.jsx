import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    id,
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select an option...',
    error,
    helperText,
    leftIcon: LeftIcon,
    required = false,
    disabled = false,
    fullWidth = true,
    className = '',
    children,
    ...props
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
      {label && (
        <label
          htmlFor={selectId}
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

        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={`
            block w-full appearance-none rounded-lg border text-sm transition-colors py-2 pr-9
            ${LeftIcon ? 'pl-9' : 'pl-3.5'}
            ${
              error
                ? 'border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                : 'border-slate-300 text-slate-900 focus:border-teal-500 focus:ring-teal-500'
            }
            ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${className}
          `}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="text-slate-400">
              {placeholder}
            </option>
          )}

          {children ||
            options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
        </select>

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {error ? (
            <AlertCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </div>
      </div>

      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="text-xs text-slate-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Select;

