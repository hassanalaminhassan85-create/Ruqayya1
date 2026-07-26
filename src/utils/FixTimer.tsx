import React, { useEffect } from 'react';

/**
 * This component fixes the timer issue by dynamically injecting 
 * the correct timer logic into the DOM. You only need to import 
 * this component once in your root App.tsx (or main entry file) 
 * and it will fix all timer instances across your entire app automatically.
 */
export const FixTimer: React.FC = () => {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll('.active-cycle-timer-placeholder');
      elements.forEach((el) => {
        if (!el.getAttribute('data-fixed')) {
          el.setAttribute('data-fixed', 'true');
          const start = el.getAttribute('data-start') || new Date().toISOString();
          
          // Inject a simple timer loop
          const interval = setInterval(() => {
            const diff = new Date(start).getTime() + (30 * 24 * 60 * 60 * 1000) - new Date().getTime();
            if (diff <= 0) {
              el.innerHTML = "0D 0H 0M 0S";
            } else {
              const d = Math.floor(diff / (1000 * 60 * 60 * 24));
              const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
              const m = Math.floor((diff / 1000 / 60) % 60);
              const s = Math.floor((diff / 1000) % 60);
              el.innerHTML = `${d}D ${h}H ${m}M ${s}S`;
            }
          }, 1000);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
