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
      {/* Dynamic spinning glow background ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-brand-gold via-transparent to-brand-navy dark:to-blue-500 opacity-60 blur-[3px]"
        animate={{
          rotate: 360,
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          rotate: {
            repeat: Infinity,
            duration: 3,
            ease: "linear"
          },
          scale: {
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut"
          }
        }}
      />

      {/* Floating and interactive logo container */}
      <motion.div
        className="relative h-full w-full rounded-full overflow-hidden border-2 border-brand-gold/80 dark:border-brand-gold shadow-lg cursor-pointer bg-white"
        whileHover={{
          scale: 1.18,
          rotate: 360,
          boxShadow: "0 0 20px rgba(212, 163, 89, 0.8)",
        }}
        whileTap={{ scale: 0.92, rotate: -45 }}
        animate={animateContinuous ? {
          y: [0, -5, 0],
          filter: ["drop-shadow(0px 2px 4px rgba(0,0,0,0.1))", "drop-shadow(0px 10px 15px rgba(212,163,89,0.3))", "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))"]
        } : {}}
        transition={{
          y: {
            repeat: Infinity,
            duration: 3,
            ease: "easeInOut"
          },
          filter: {
            repeat: Infinity,
            duration: 3,
            ease: "easeInOut"
          },
          // Spring physics for hover rotation
          rotate: {
            type: "spring",
            stiffness: 120,
            damping: 12
          },
          scale: {
            type: "spring",
            stiffness: 300,
            damping: 15
          }
        }}
      >
        <img
          src="/logo.png"
          alt="Ruqayya Transport Official Logo"
          className="h-full w-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      </motion.div>

      {/* Pulsing orbiting decorative indicator */}
      <motion.div
        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-white dark:border-slate-950 shadow-xs"
        animate={{
          scale: [1, 1.4, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut"
        }}
      />
    </div>
  );
};
