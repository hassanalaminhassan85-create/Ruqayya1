/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-text-main">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full px-3 py-2 text-sm bg-bg-surface border ${error ? 'border-brand-danger' : 'border-border-main'} rounded-lg text-text-main focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-400' : 'focus:ring-slate-400'} placeholder:text-text-muted/60 transition-all ${className}`}
        {...props}
      />
      {error && (
        <span className="text-[11px] font-medium text-brand-danger">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span className="text-[10px] text-text-muted">
          {helperText}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-text-main">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`w-full px-3 py-2 text-sm bg-bg-surface border ${error ? 'border-brand-danger' : 'border-border-main'} rounded-lg text-text-main focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[11px] font-medium text-brand-danger">
          {error}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
