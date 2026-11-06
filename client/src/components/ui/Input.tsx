import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  unit?: string;
  isLargeNumeric?: boolean; // Mobile outdoor large numeric input
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  unit,
  isLargeNumeric = false,
  className = '',
  disabled,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative rounded-button shadow-sm">
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`
            block w-full rounded-button border bg-white transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
            disabled:bg-background disabled:text-text-muted disabled:cursor-not-allowed
            ${error ? 'border-error text-error focus:ring-error focus:border-error' : 'border-border text-text-main'}
            ${unit ? 'pr-12' : 'pr-3'}
            ${isLargeNumeric
              ? 'text-2xl font-bold py-3.5 px-4 tracking-wide' // High contrast large numeric for field collection
              : 'text-sm py-2 px-3'}
            ${className}
          `}
          {...props}
        />
        {unit && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
            <span className={`text-text-muted font-medium ${isLargeNumeric ? 'text-base font-semibold' : 'text-xs'}`}>
              {unit}
            </span>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-error flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

