/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MapPin, Phone, Mail, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { CircularLogo } from './CircularLogo';
import { motion } from 'motion/react';

interface FooterProps {
  lang?: 'en' | 'ha';
}

export const Footer: React.FC<FooterProps> = ({ lang = 'en' }) => {
  return (
    <footer className="w-full bg-[#0b132b] text-slate-300 border-t border-brand-gold/30 mt-auto pt-10 pb-8 px-4 sm:px-8 relative overflow-hidden font-sans">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-gold/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        
        {/* Column 1: Brand & Bio */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CircularLogo size="md" />
            <div>
              <span className="font-black text-base tracking-wider text-white font-mono block">RUQAYYA</span>
              <span className="text-[10px] font-bold text-brand-gold tracking-widest block uppercase -mt-1">
                {lang === 'en' ? "TRANSPORT & ENTERPRISE ERP" : "SUFURI DA KULA DA KASUWANCI"}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === 'en'
              ? "Official digital fleet operations, daily remittance tracking, and investor stakeholder management system for Maiduguri terminal hubs."
              : "Babban tsarin kula da motoci, lissafin kudin shiga na yau da kullum, da kuma harkar hannun jari na tashar mota ta Maiduguri."}
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <ShieldCheck className="h-4 w-4 text-brand-gold shrink-0" />
            <span>{lang === 'en' ? "Secure Cloudflare D1 Node Active" : "Tsaron Tsarin Cloudflare D1 Yana Aiki"}</span>
          </div>
        </div>

        {/* Column 2: Official Address */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-brand-gold font-mono flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-gold shrink-0" />
            {lang === 'en' ? "Official Headquarters" : "Babban Adireshin Ofishi"}
          </h4>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-white">
              {lang === 'en' 
                ? "No. 38, Off Bolori Market Junction, Near Traffic Light, Baga Road, Maiduguri, Borno State, Nigeria"
                : "Lamba 38, Kusa da Mabudin Kasuwar Bolori, Kusa da Fitilar Titi, Titin Baga, Maiduguri, Jihar Borno, Najeriya"}
            </p>
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{lang === 'en' ? "Terminal Operations: 06:00 - 20:00 WAT" : "Ayyukan Tasha: Karfe 06:00 zuwa 20:00"}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Support Contacts (Phone & Email with hover micro-interactions) */}
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-brand-gold font-mono flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-gold shrink-0" />
            {lang === 'en' ? "Support Contacts & Hotline" : "Lambobin Taimako da Gaggawa"}
          </h4>
          <div className="flex flex-col gap-2">
            {/* Phone 1 */}
            <motion.a
              href="tel:07010204110"
              whileHover={{ x: 4, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-brand-gold/50 text-xs font-bold text-slate-200 hover:text-brand-gold transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-slate-950 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono tracking-wide">0701 020 4110</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono group-hover:text-brand-gold">
                {lang === 'en' ? "Primary" : "Babba"}
              </span>
            </motion.a>

            {/* Phone 2 */}
            <motion.a
              href="tel:07069630662"
              whileHover={{ x: 4, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-brand-gold/50 text-xs font-bold text-slate-200 hover:text-brand-gold transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-slate-950 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono tracking-wide">0706 963 0662</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono group-hover:text-brand-gold">
                {lang === 'en' ? "Secondary" : "Na Biyu"}
              </span>
            </motion.a>

            {/* Email */}
            <motion.a
              href="mailto:muhdadam573@gmail.com"
              whileHover={{ x: 4, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 text-xs font-bold text-slate-200 hover:text-blue-400 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono tracking-wide truncate">muhdadam573@gmail.com</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono group-hover:text-blue-400 shrink-0 ml-2">
                {lang === 'en' ? "Email" : "Imel"}
              </span>
            </motion.a>
          </div>
        </div>

      </div>

      {/* Footer Bottom Bar */}
      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 relative z-10">
        <p>
          © 2026 Ruqayya Transport & Enterprise Limited. {lang === 'en' ? "All rights reserved." : "An kiyaye duk haƙƙoƙi."}
        </p>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="text-brand-gold">RUQAYYA ERP v4.2</span>
          <span>•</span>
          <span>Maiduguri Terminal Hub</span>
        </div>
      </div>
    </footer>
  );
};
