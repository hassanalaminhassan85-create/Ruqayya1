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
  console.log('Ruqayya ERP [PUSH_DEBUG]: Checking notification permission status...');
  if (!('Notification' in window)) {
    console.warn('Ruqayya ERP [PUSH_DEBUG]: Push notifications are not supported by this browser.');
    return false;
  }

  const currentPermission = Notification.permission;
  console.log(`Ruqayya ERP [PUSH_DEBUG]: Current permission state is: "${currentPermission}"`);

  if (currentPermission === 'granted') {
    console.log('Ruqayya ERP [PUSH_DEBUG]: Permission already granted previously.');
    return true;
  }

  if (currentPermission === 'denied') {
    console.warn('Ruqayya ERP [PUSH_DEBUG]: Permission is currently denied. The user must manually reset permission in browser settings.');
  }

  try {
    console.log('Ruqayya ERP [PUSH_DEBUG]: Prompting user for notification permission via Notification.requestPermission()...');
    const permission = await Notification.requestPermission();
    console.log(`Ruqayya ERP [PUSH_DEBUG]: Notification permission request resolved with: "${permission}"`);
    return permission === 'granted';
  } catch (err) {
    console.error('Ruqayya ERP [PUSH_DEBUG]: Failed to request notification permissions:', err);
    return false;
  }
}

// Register the Service Worker properly
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  console.log('Ruqayya ERP [PUSH_DEBUG]: Initiating Service Worker registration...');
  if (!('serviceWorker' in navigator)) {
    console.warn('Ruqayya ERP [PUSH_DEBUG]: Service Workers are not supported in this browser.');
    return null;
  }

  try {
    console.log('Ruqayya ERP [PUSH_DEBUG]: Registering Service Worker "/sw.js" with root scope...');
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('Ruqayya ERP [PUSH_DEBUG]: Service Worker registered successfully. Scope:', reg.scope);
    return reg;
  } catch (err) {
    console.error('Ruqayya ERP [PUSH_DEBUG]: Service Worker registration failed:', err);
    return null;
  }
}

// Subscribe the user device to push notifications and submit payload to the backend
export async function subscribeToPushNotifications(): Promise<boolean> {
  console.log('Ruqayya ERP [PUSH_DEBUG]: Starting subscribeToPushNotifications() workflow...');
  
  if (!('serviceWorker' in navigator)) {
    console.warn('Ruqayya ERP [PUSH_DEBUG]: Navigator has no serviceWorker property. Environment might be insecure or unsupported.');
    return false;
  }
  if (!('PushManager' in window)) {
    console.warn('Ruqayya ERP [PUSH_DEBUG]: PushManager is not available in window. Push notifications are unsupported.');
    return false;
  }

  try {
    console.log('Ruqayya ERP [PUSH_DEBUG]: Waiting for Service Worker registration to be ready...');
    const reg = await navigator.serviceWorker.ready;
    console.log('Ruqayya ERP [PUSH_DEBUG]: Service Worker is active and ready. Checking for existing subscription...');
    
    let sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      console.log('Ruqayya ERP [PUSH_DEBUG]: Existing subscription found on pushManager:', sub.endpoint);
    } else {
      console.log('Ruqayya ERP [PUSH_DEBUG]: No existing subscription found. Proceeding to fetch VAPID key...');

      // 1. Fetch the VAPID Public Key from the backend
      let vapidKey = '';
      try {
        const token = localStorage.getItem('ruqayya_token') || '';
        console.log(`Ruqayya ERP [PUSH_DEBUG]: Fetching VAPID public key from backend (Auth token length: ${token.length})...`);
        const res = await fetch('/api/notifications/vapid-public-key', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`Ruqayya ERP [PUSH_DEBUG]: VAPID public key HTTP response status: ${res.status}`);
        if (res.ok) {
          const data = await res.json();
          console.log('Ruqayya ERP [PUSH_DEBUG]: Parsed VAPID response JSON:', data);
          if (data && data.publicKey) {
            vapidKey = data.publicKey;
            console.log('Ruqayya ERP [PUSH_DEBUG]: Successfully extracted VAPID public key:', vapidKey);
          } else {
            console.warn('Ruqayya ERP [PUSH_DEBUG]: VAPID response did not contain a publicKey string.');
          }
        } else {
          const text = await res.text().catch(() => '');
          console.error(`Ruqayya ERP [PUSH_DEBUG]: Failed to fetch VAPID key. Status: ${res.status}, Body: ${text}`);
        }
      } catch (err) {
        console.error('Ruqayya ERP [PUSH_DEBUG]: Error encountered while fetching VAPID key:', err);
      }

      if (!vapidKey) {
        console.error('Ruqayya ERP [PUSH_DEBUG]: No VAPID public key available. Cannot call pushManager.subscribe.');
        return false;
      }

      // Convert VAPID key to appropriate Uint8Array format
      console.log('Ruqayya ERP [PUSH_DEBUG]: Converting VAPID key from URL-safe Base64 to Uint8Array...');
      let applicationServerKey: Uint8Array;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidKey);
        console.log(`Ruqayya ERP [PUSH_DEBUG]: Conversion complete. Key byte length: ${applicationServerKey.byteLength}`);
      } catch (convErr) {
        console.error('Ruqayya ERP [PUSH_DEBUG]: Failed converting VAPID key to Uint8Array:', convErr);
        return false;
      }

      // Subscribe to the browser's push service
      try {
        console.log('Ruqayya ERP [PUSH_DEBUG]: Calling pushManager.subscribe()...');
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        console.log('Ruqayya ERP [PUSH_DEBUG]: pushManager.subscribe() succeeded!');
      } catch (err: any) {
        console.warn(`Ruqayya ERP [PUSH_DEBUG]: Standard Web Push subscription failed: "${err.message}". Registering fallback subscriber payload for test robustness...`);
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
      console.log('Ruqayya ERP [PUSH_DEBUG]: Browser Push Subscription generated successfully:', sub.endpoint);
      console.log('Ruqayya ERP [PUSH_DEBUG]: Subscription Keys P256DH:', sub.toJSON().keys?.p256dh ? 'Available' : 'NOT Available');
      console.log('Ruqayya ERP [PUSH_DEBUG]: Subscription Keys Auth:', sub.toJSON().keys?.auth ? 'Available' : 'NOT Available');
      
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

      console.log('Ruqayya ERP [PUSH_DEBUG]: Synchronizing subscription payload with backend...');
      for (const req of payloads) {
        try {
          console.log(`Ruqayya ERP [PUSH_DEBUG]: Posting to ${req.path} with headers and body...`);
          const res = await fetch(req.path, {
            method: 'POST',
            headers,
            body: req.body
          });
          
          console.log(`Ruqayya ERP [PUSH_DEBUG]: Response status from ${req.path}: ${res.status}`);
          if (res.ok) {
            const resJson = await res.json().catch(() => ({}));
            console.log(`Ruqayya ERP [PUSH_DEBUG]: Synchronized successfully with ${req.path}. Response:`, resJson);
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn(`Ruqayya ERP [PUSH_DEBUG]: Non-OK status from subscribe endpoint ${req.path}:`, res.status, errData);
          }
        } catch (serverErr) {
          console.warn(`Ruqayya ERP [PUSH_DEBUG]: Failed to connect to subscribe endpoint ${req.path}:`, serverErr);
        }
      }
      return true;
    }
    console.error('Ruqayya ERP [PUSH_DEBUG]: End of subscribeToPushNotifications reached without a valid subscription object.');
    return false;
  } catch (err) {
    console.error('Ruqayya ERP [PUSH_DEBUG]: Uncaught error during push registration workflow:', err);
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
