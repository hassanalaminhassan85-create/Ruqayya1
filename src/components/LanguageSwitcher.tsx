/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Globe } from 'lucide-react';
import { Language } from '../types';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLanguage, onLanguageChange }) => {
  return (
    <div className="flex items-center gap-1.5 border border-border-main/50 rounded-lg p-1 bg-bg-base">
      <button
        onClick={() => onLanguageChange('en')}
        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
          currentLanguage === 'en'
            ? 'bg-brand-navy text-white shadow-xs'
            : 'text-text-muted hover:text-text-main hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => onLanguageChange('ha')}
        className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
          currentLanguage === 'ha'
            ? 'bg-brand-navy text-white shadow-xs'
            : 'text-text-muted hover:text-text-main hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        HA
      </button>
    </div>
  );
};
