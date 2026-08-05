/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface CircularLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  animateContinuous?: boolean;
}

export const CircularLogo: React.FC<CircularLogoProps> = ({
  size = 'md',
  className = '',
  animateContinuous = true
}) => {
  // Define dimensions based on size presets
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-base',
    xl: 'h-24 w-24 text-lg',
    '2xl': 'h-36 w-36 text-xl'
  }[size];

  // Particle or ring animations to add "super high motion" feel
  return (
    <div className={`relative flex items-center justify-center ${sizeClasses} ${className}`}>
      {/* 1. Outermost ambient glowing expanding pulse ring (breathing ripple) */}
      <motion.div
        className="absolute inset-[-12%] rounded-full bg-brand-gold/15 dark:bg-brand-gold/20 blur-[6px] pointer-events-none"
        animate={{
          scale: [0.9, 1.25, 0.9],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          repeat: Infinity,
          duration: 4,
          ease: "easeInOut"
        }}
      />

      {/* 2. Dotted gold technical orbit ring spinning clockwise */}
      <motion.div
        className="absolute inset-[-6%] rounded-full border-2 border-dashed border-brand-gold/40 dark:border-brand-gold/60 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 12,
          ease: "linear"
        }}
      />

      {/* 3. Outer gradient glowing ring spinning counter-clockwise */}
      <motion.div
        className="absolute inset-[-2%] rounded-full bg-gradient-to-tr from-brand-gold via-transparent to-brand-navy dark:to-blue-500 opacity-65 blur-[2px]"
        animate={{
          rotate: -360,
          scale: [0.97, 1.03, 0.97],
        }}
        transition={{
          rotate: {
            repeat: Infinity,
            duration: 4,
            ease: "linear"
          },
          scale: {
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut"
          }
        }}
      />

      {/* 4. Interactive and high-motion core logo container */}
      <motion.div
        className="relative h-full w-full rounded-full overflow-hidden border-[2.5px] border-brand-gold/90 dark:border-brand-gold shadow-xl cursor-pointer bg-white"
        whileHover={{
          scale: 1.15,
          rotate: 360,
          boxShadow: "0 0 25px rgba(212, 163, 89, 0.95)",
        }}
        whileTap={{ scale: 0.92, rotate: -45 }}
        animate={animateContinuous ? {
          y: [0, -6, 0],
          filter: ["drop-shadow(0px 2px 4px rgba(0,0,0,0.15))", "drop-shadow(0px 12px 20px rgba(212,163,89,0.45))", "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"]
        } : {}}
        transition={{
          y: {
            repeat: Infinity,
            duration: 2.8,
            ease: "easeInOut"
          },
          filter: {
            repeat: Infinity,
            duration: 2.8,
            ease: "easeInOut"
          },
          rotate: {
            type: "spring",
            stiffness: 140,
            damping: 10
          },
          scale: {
            type: "spring",
            stiffness: 350,
            damping: 14
          }
        }}
      >
        <img onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"; }}
          src="/logo.png"
          alt="Ruqayya Transport Official Logo"
          className="h-full w-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      </motion.div>

      {/* 5. Pulsing orbiting decorative status indicator */}
      <motion.div
        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-950 shadow-md z-10"
        animate={{
          scale: [1, 1.45, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.2,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};
