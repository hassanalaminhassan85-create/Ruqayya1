import React, { useState, useEffect } from 'react';

interface TimeDisplayProps {
  isTimeSynced: boolean;
  timeStr: string;
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({ isTimeSynced, timeStr }) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Parse timeStr (format: HH:MM:SS WAT) to position the clock hands
  useEffect(() => {
    if (!timeStr) return;
    const parts = timeStr.split(' ')[0].split(':');
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parseInt(parts[2], 10);
      
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    }
  }, [timeStr]);

  // Calculate rotation angles
  // Hour hand: 30 degrees per hour + 0.5 degrees per minute
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  // Minute hand: 6 degrees per minute + 0.1 degrees per second
  const minuteAngle = minutes * 6 + seconds * 0.1;
  // Second hand: 6 degrees per second
  const secondAngle = seconds * 6;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" id="wat-time-display-container">
      {/* CSS-Based SVG Analog Clock Face */}
      <div className="relative w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-slate-900 border border-slate-700/60 shadow-inner shrink-0" id="analog-clock-wrapper">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Clock face ticks/markers (4 primary dots) */}
          <circle cx="50" cy="12" r="2.5" className="fill-slate-500" />
          <circle cx="88" cy="50" r="2.5" className="fill-slate-500" />
          <circle cx="50" cy="88" r="2.5" className="fill-slate-500" />
          <circle cx="12" cy="50" r="2.5" className="fill-slate-500" />

          {/* Hour Hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="28"
            strokeLinecap="round"
            className="stroke-slate-300"
            strokeWidth="5"
            transform={`rotate(${hourAngle} 50 50)`}
            style={{
              transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 1)',
              transformOrigin: '50px 50px',
            }}
          />

          {/* Minute Hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="18"
            strokeLinecap="round"
            className="stroke-slate-100"
            strokeWidth="3.5"
            transform={`rotate(${minuteAngle} 50 50)`}
            style={{
              transition: 'transform 0.5s cubic-bezier(0.4, 2.08, 0.55, 1)',
              transformOrigin: '50px 50px',
            }}
          />

          {/* Second Hand (Golden Accent) */}
          <line
            x1="50"
            y1="58"
            x2="50"
            y2="12"
            strokeLinecap="round"
            className="stroke-amber-500"
            strokeWidth="1.8"
            transform={`rotate(${secondAngle} 50 50)`}
            style={{
              transition: secondAngle === 0 ? 'none' : 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              transformOrigin: '50px 50px',
            }}
          />

          {/* Center Pin */}
          <circle cx="50" cy="50" r="4.5" className="fill-amber-500 stroke-slate-900 stroke-[1.5]" />
        </svg>

        {/* Pulse Ring when actively synced with high precision NTP/API sources */}
        {isTimeSynced && (
          <span className="absolute inset-0 rounded-full border border-amber-500/30 animate-ping pointer-events-none scale-105" />
        )}
      </div>

      {/* Digital Readout */}
      <span className="font-mono text-text-muted text-[10px] sm:text-xs md:text-sm tracking-wide shrink-0" id="digital-wat-clock">
        {timeStr}
      </span>
    </div>
  );
};
