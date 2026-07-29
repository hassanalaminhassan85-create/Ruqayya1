/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  ...props 
}) => {
  const variants = {
    default: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
    secondary: "bg-slate-100 text-slate-800 border-slate-200",
    destructive: "bg-red-50 text-red-700 border-red-100",
    outline: "text-text-main border-border-main",
    success: "bg-green-50 text-green-700 border-green-100",
    warning: "bg-orange-50 text-orange-700 border-orange-100",
  };

  return (
    <div 
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
