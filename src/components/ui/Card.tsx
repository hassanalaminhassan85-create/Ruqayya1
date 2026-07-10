/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  animateEntrance?: boolean;
  delayIndex?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverEffect = false,
  animateEntrance = false,
  delayIndex = 0,
  ...props
}) => {
  const baseClass = "bg-bg-surface border border-border-main rounded-[20px] p-6 shadow-xs overflow-hidden";
  const hoverClass = hoverEffect ? "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300" : "";
  
  if (animateEntrance) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: delayIndex * 0.05 }}
        className={`${baseClass} ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClass} ${hoverClass} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`border-b border-border-main pb-4 mb-5 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...props }) => (
  <h3 className={`text-[22px] font-bold text-text-main tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className = '', ...props }) => (
  <p className={`text-[14px] font-medium text-text-muted mt-1.5 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);
