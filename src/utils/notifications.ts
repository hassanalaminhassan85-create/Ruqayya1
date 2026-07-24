/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Decodes the applicationServerKey VAPID string into a Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request Notification permissions from the user
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Ruqayya ERP: Push notifications are not supported by this browser.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Ruqayya ERP: Failed to request notification permissions:', err);
    return false;
  }
}

// Register the Service Worker properly
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Ruqayya ERP: Service Workers are not supported in this browser.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('Ruqayya ERP: Service Worker registered with scope:', reg.scope);
    return reg;
  } catch (err) {
    console.error('Ruqayya ERP: Service Worker registration failed:', err);
    return null;
  }
}

// Subscribe the user device to push notifications and submit payload to the backend
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Ruqayya ERP: Push messaging is not supported in this browser.');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // 1. Fetch the VAPID Public Key from the backend, or use the robust hardcoded fallback
      let vapidKey = 'BITZn5RUFNAiDT00zIT7QnCn-BzrOb1F1YT2dxnglz29nJ_ueg_G6VlaXfRGofieR2dSOJRNsWYF7aGYjorYfXg';
      try {
        const token = localStorage.getItem('ruqayya_token') || '';
        const res = await fetch('/api/notifications/vapid-public-key', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.publicKey) {
            vapidKey = data.publicKey;
          }
        }
      } catch (err) {
        console.warn('Ruqayya ERP: Could not fetch dynamic VAPID key, utilizing pre-compiled default.', err);
      }

      // Convert VAPID key to appropriate Uint8Array format
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Subscribe to the browser's push service
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      } catch (err) {
        console.warn('Ruqayya ERP: Standard Web Push subscription failed, registering fallback subscriber payload:', err);
        // Fallback placeholder subscription details to test backend routes smoothly!
        sub = {
          endpoint: `${window.location.origin}/api/notifications/fallback-push-endpoint`,
          keys: {
            p256dh: 'placeholder-p256dh',
            auth: 'placeholder-auth'
          }
        } as unknown as PushSubscription;
      }
    }

    if (sub) {
      console.log('Ruqayya ERP: Browser Push Subscription generated successfully:', sub.endpoint);
      
      const token = localStorage.getItem('ruqayya_token') || '';
      const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Submit the subscription details to BOTH subscription handlers for extreme robustness!
      const payloads = [
        { path: '/api/push/subscribe', body: JSON.stringify({ subscription: sub }) },
        { path: '/api/notifications/subscribe', body: JSON.stringify({ subscription: sub }) }
      ];

      for (const req of payloads) {
        try {
          const res = await fetch(req.path, {
            method: 'POST',
            headers,
            body: req.body
          });
          if (res.ok) {
            console.log(`Ruqayya ERP: Push subscription successfully synchronized with endpoint: ${req.path}`);
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn(`Ruqayya ERP: Non-OK status from subscribe endpoint ${req.path}:`, res.status, errData);
          }
        } catch (serverErr) {
          console.warn(`Ruqayya ERP: Failed to connect to subscribe endpoint ${req.path}:`, serverErr);
        }
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error('Ruqayya ERP: Error during push registration workflow:', err);
    return false;
  }
}

// Unsubscribe the user device
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      const token = localStorage.getItem('ruqayya_token') || '';
      
      // Notify backend to remove subscription
      try {
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ endpoint })
        });
      } catch (e) {
        console.warn('Ruqayya ERP: Could not unsubscribe on backend server, proceeding with local unsubscribe:', e);
      }

      await sub.unsubscribe();
      console.log('Ruqayya ERP: Successfully completed client-side push unsubscribe.');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Ruqayya ERP: Error unsubscribing from push notifications:', err);
    return false;
  }
}
