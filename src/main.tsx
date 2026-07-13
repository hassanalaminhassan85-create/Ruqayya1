import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the Service Worker for offline PWA capabilities and lock screen push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('RUQAYYA TRANSPORT LIMITED: Service Worker registered scope:', reg.scope);
        
        // Check for updates to the service worker file
        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // A new service worker version is ready and waiting to take control!
                  console.log('RUQAYYA TRANSPORT LIMITED: New version available. Dispatching notification...');
                  window.dispatchEvent(new CustomEvent('pwa-update-available'));
                }
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('RUQAYYA TRANSPORT LIMITED: Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
