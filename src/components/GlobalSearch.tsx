/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Bike, User, ArrowRight, X, Clock as ClockIcon } from 'lucide-react';
import { dbStore } from '../utils/dbStore';
import { Vehicle, Driver, DailyRemittance } from '../types';

interface GlobalSearchProps {
  onSelectResult?: (type: 'vehicle' | 'driver' | 'trip', id: string) => void;
  lang: 'en' | 'ha';
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelectResult, lang }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<{
    vehicles: Vehicle[];
    drivers: Driver[];
    trips: DailyRemittance[];
  }>({ vehicles: [], drivers: [], trips: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recents on mount
  useEffect(() => {
    const saved = localStorage.getItem('ruqayya_recent_searches');
    if (saved) {
      try {
        setRecents(JSON.parse(saved));
      } catch (e) {
        setRecents([]);
      }
    }
  }, []);

  // Save a recent search
  const saveToRecents = (term: string) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim();
    const updated = [cleanTerm, ...recents.filter(r => r !== cleanTerm)].slice(0, 3);
    setRecents(updated);
    localStorage.setItem('ruqayya_recent_searches', JSON.stringify(updated));
  };

  // Clear recents
  const clearRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecents([]);
    localStorage.removeItem('ruqayya_recent_searches');
  };

  // Debouncing effect for typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Execute search filter when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults({ vehicles: [], drivers: [], trips: [] });
      return;
    }

    const q = debouncedQuery.toLowerCase();
    const vehicles = dbStore.getVehicles().filter(
      v => String(v.plateNumber || '').toLowerCase().includes(q) || String(v.model || '').toLowerCase().includes(q)
    );
    const drivers = dbStore.getDrivers().filter(
      d => String(d.fullName || '').toLowerCase().includes(q) || String(d.licenseNumber || '').toLowerCase().includes(q) || String(d.phone || '').includes(q)
    );
    const trips = dbStore.getTrips().filter(
      t => String(t.remittanceNumber || '').toLowerCase().includes(q) || String(t.origin || '').toLowerCase().includes(q) || String(t.destination || '').toLowerCase().includes(q) || String(t.tricycleType || '').toLowerCase().includes(q)
    );

    setResults({ vehicles, drivers, trips });
    setShowDropdown(true);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Text highlighting utility
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-amber-500/20 text-brand-gold rounded px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const hasResults = results.vehicles.length > 0 || results.drivers.length > 0 || results.trips.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={lang === 'en' ? "Search fleet, drivers, remittance IDs..." : "Bincika motoci, direbobi, ko lamba..."}
          className="w-full pl-9 pr-8 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-text-muted/50 transition-all shadow-2xs"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setDebouncedQuery(''); setResults({ vehicles: [], drivers: [], trips: [] }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:bg-bg-base rounded p-0.5 text-text-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-surface border border-border-main rounded-xl shadow-2xl z-50 max-h-[360px] overflow-y-auto p-2 scrollbar-none">
          {/* Recent Searches section (when search query is empty) */}
          {!query.trim() && recents.length > 0 && (
            <div className="p-2 border-b border-border-main/50 pb-2 mb-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                <span>{lang === 'en' ? "Recent Searches" : "Binciken Kusa"}</span>
                <button onClick={clearRecents} className="hover:text-rose-500 font-sans normal-case text-[9px]">
                  {lang === 'en' ? "Clear All" : "Goge Duka"}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {recents.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setQuery(item);
                      setDebouncedQuery(item);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-bg-base/70 cursor-pointer text-xs text-text-main font-medium transition-colors"
                  >
                    <ClockIcon className="h-3 w-3 text-text-muted shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!query.trim() && recents.length === 0 && (
            <div className="p-4 text-center text-xs text-text-muted font-sans">
              {lang === 'en' ? "Type to search enterprise registers" : "Fara rubutu domin bincika rumbun bayani"}
            </div>
          )}

          {query.trim() && !hasResults && (
            <div className="p-4 text-center text-xs text-text-muted">
              {lang === 'en' ? "No matching corporate records found" : "Ba a sami dace da takardun kamfanin ba"}
            </div>
          )}

          {query.trim() && hasResults && (
            <div className="flex flex-col gap-3 p-1">
              {/* Trips / Remittances */}
              {results.trips.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider px-2 mb-1">
                    {lang === 'en' ? "Daily Remittances" : "Kudaden Remittance"}
                  </h5>
                  <div className="flex flex-col gap-0.5">
                    {results.trips.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          saveToRecents(query);
                          onSelectResult?.('trip', t.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">
                              {highlightText(t.remittanceNumber, query)}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              {highlightText(t.origin, query)} → {highlightText(t.destination, query)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicles / Tricycles */}
              {results.vehicles.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider px-2 mb-1">
                    {lang === 'en' ? "Fleet Tricycles" : "Rukunin Kekuna"}
                  </h5>
                  <div className="flex flex-col gap-0.5">
                    {results.vehicles.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          saveToRecents(query);
                          onSelectResult?.('vehicle', v.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Bike className="h-3.5 w-3.5 text-blue-500" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">
                              {highlightText(v.plateNumber, query)}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              {highlightText(v.model, query)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drivers */}
              {results.drivers.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider px-2 mb-1">
                    {lang === 'en' ? "Professional Drivers" : "Rijistar Direbobi"}
                  </h5>
                  <div className="flex flex-col gap-0.5">
                    {results.drivers.map(d => (
                      <div
                        key={d.id}
                        onClick={() => {
                          saveToRecents(query);
                          onSelectResult?.('driver', d.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-emerald-500" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">
                              {highlightText(d.fullName, query)}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              {highlightText(d.phone, query)}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
