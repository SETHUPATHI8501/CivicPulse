import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

const Textarea = forwardRef(function Textarea(
  {
    id,
    label,
    placeholder,
    value,
    onChange,
    rows = 4,
    maxLength,
    showCount = false,
    error,
    helperText,
    required = false,
    disabled = false,
    fullWidth = true,
    className = '',
    ...props
  },
  ref
) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1.5`}>
      <div className="flex justify-between items-center">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-slate-700 tracking-wide"
          >
            {label}
            {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        {showCount && maxLength && (
          <span className="text-[11px] text-slate-400 font-mono">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>

      <div className="relative rounded-lg shadow-sm">
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            block w-full rounded-lg border text-sm transition-colors py-2 px-3.5
            ${
              error
                ? 'border-rose-300 text-rose-900 placeholder-rose-300 focus:border-rose-500 focus:ring-rose-500'
                : 'border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500'
            }
            ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white'}
            focus:outline-none focus:ring-2 focus:ring-offset-0 resize-y
            ${className}
          `}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />

        {error && (
          <div className="pointer-events-none absolute top-2.5 right-3 flex items-center">
            <AlertCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
          </div>
        )}
      </div>

      {error ? (
        <p id={`${textareaId}-error`} className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="text-xs text-slate-500 mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Textarea;

