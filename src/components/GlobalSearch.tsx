/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Truck, User, ArrowRight, X } from 'lucide-react';
import { dbStore } from '../utils/dbStore';
import { Vehicle, Driver, TripManifest } from '../types';

interface GlobalSearchProps {
  onSelectResult?: (type: 'vehicle' | 'driver' | 'trip', id: string) => void;
  lang: 'en' | 'ha';
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelectResult, lang }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    vehicles: Vehicle[];
    drivers: Driver[];
    trips: TripManifest[];
  }>({ vehicles: [], drivers: [], trips: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults({ vehicles: [], drivers: [], trips: [] });
      return;
    }

    const q = val.toLowerCase();
    const vehicles = dbStore.getVehicles().filter(
      v => v.plateNumber.toLowerCase().includes(q) || v.model.toLowerCase().includes(q)
    );
    const drivers = dbStore.getDrivers().filter(
      d => d.fullName.toLowerCase().includes(q) || d.licenseNumber.toLowerCase().includes(q) || d.phone.includes(q)
    );
    const trips = dbStore.getTrips().filter(
      t => t.manifestNumber.toLowerCase().includes(q) || t.origin.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q) || t.cargoType.toLowerCase().includes(q)
    );

    setResults({ vehicles, drivers, trips });
    setShowDropdown(true);
  };

  const hasResults = results.vehicles.length > 0 || results.drivers.length > 0 || results.trips.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          placeholder={lang === 'en' ? "Search fleet, drivers, manifest IDs..." : "Bincika motoci, direbobi, ko lamba..."}
          className="w-full pl-9 pr-8 py-2 text-xs bg-bg-surface border border-border-main rounded-lg text-text-main focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-text-muted/50 transition-all shadow-2xs"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults({ vehicles: [], drivers: [], trips: [] }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:bg-bg-base rounded p-0.5 text-text-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-surface border border-border-main rounded-xl shadow-2xl z-50 max-h-[360px] overflow-y-auto p-2 scrollbar-none">
          {!hasResults ? (
            <div className="p-4 text-center text-xs text-text-muted">
              {lang === 'en' ? "No matching corporate records found" : "Ba a sami dace da takardun kamfanin ba"}
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-1">
              {/* Trips */}
              {results.trips.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider px-2 mb-1">
                    {lang === 'en' ? "Manifests" : "Takardun Tafiya"}
                  </h5>
                  <div className="flex flex-col gap-0.5">
                    {results.trips.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onSelectResult?.('trip', t.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">{t.manifestNumber}</p>
                            <p className="text-[10px] text-text-muted">{t.origin} → {t.destination}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicles */}
              {results.vehicles.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider px-2 mb-1">
                    {lang === 'en' ? "Fleet Vehicles" : "Manyan Motoci"}
                  </h5>
                  <div className="flex flex-col gap-0.5">
                    {results.vehicles.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          onSelectResult?.('vehicle', v.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-blue-500" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">{v.plateNumber}</p>
                            <p className="text-[10px] text-text-muted">{v.model}</p>
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
                          onSelectResult?.('driver', d.id);
                          setShowDropdown(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-bg-base/80 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-emerald-500" />
                          <div>
                            <p className="text-[11px] font-bold text-text-main">{d.fullName}</p>
                            <p className="text-[10px] text-text-muted">{d.phone}</p>
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
