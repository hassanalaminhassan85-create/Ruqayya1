/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  descriptionEn: string;
  descriptionHa: string;
  createdAt: string;
}

const QUEUE_KEY = 'ruqayya_pwa_sync_queue';

export const offlineSync = {
  getQueue: (): OfflineQueueItem[] => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveQueue: (queue: OfflineQueueItem[]): void => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save offline sync queue', e);
    }
  },

  clearQueue: (): void => {
    try {
      localStorage.removeItem(QUEUE_KEY);
      offlineSync.dispatchStatus('idle', 0);
    } catch {}
  },

  enqueue: (endpoint: string, method: string, body: any, descriptionEn: string, descriptionHa: string): void => {
    const queue = offlineSync.getQueue();
    
    // Prevent exact duplicate requests queued within 10 seconds of each other
    const isDuplicate = queue.some(item => 
      item.endpoint === endpoint && 
      item.method === method && 
      JSON.stringify(item.body) === JSON.stringify(body)
    );

    if (isDuplicate) {
      console.log('offlineSync: Skipping duplicate request queuing.');
      return;
    }

    const newItem: OfflineQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      endpoint,
      method,
      body,
      descriptionEn,
      descriptionHa,
      createdAt: new Date().toISOString()
    };

    queue.push(newItem);
    offlineSync.saveQueue(queue);
    offlineSync.dispatchStatus('idle', queue.length);

    // Dispatch custom event to notify UI
    window.dispatchEvent(new CustomEvent('pwa-action-queued', { detail: newItem }));
  },

  dispatchStatus: (status: 'idle' | 'synchronizing' | 'success' | 'error', count: number, syncedItem?: OfflineQueueItem) => {
    window.dispatchEvent(new CustomEvent('pwa-sync-status', { 
      detail: { status, count, syncedItem } 
    }));
  },

  sync: async (requestFn: (endpoint: string, options: any) => Promise<any>): Promise<{ successCount: number; failedCount: number }> => {
    const queue = offlineSync.getQueue();
    if (queue.length === 0) {
      offlineSync.dispatchStatus('idle', 0);
      return { successCount: 0, failedCount: 0 };
    }

    console.log(`offlineSync: Starting sync for ${queue.length} queued operations.`);
    offlineSync.dispatchStatus('synchronizing', queue.length);

    let successCount = 0;
    let failedCount = 0;
    const remainingQueue: OfflineQueueItem[] = [];

    for (const item of queue) {
      try {
        await requestFn(item.endpoint, {
          method: item.method,
          body: JSON.stringify(item.body)
        });
        successCount++;
        offlineSync.dispatchStatus('success', queue.length - successCount - failedCount, item);
        // Sleep slightly to avoid spamming
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn(`offlineSync: Sync failed for item ${item.id}`, err);
        failedCount++;
        // Keep in queue if it's a network error, discard if it's a bad request (validation issue)
        if (err instanceof Error && (err.message.includes('Validation') || err.message.includes('invalid') || err.message.includes('missing'))) {
          // Discard bad payloads to prevent blocking the queue forever
        } else {
          remainingQueue.push(item);
        }
      }
    }

    offlineSync.saveQueue(remainingQueue);
    offlineSync.dispatchStatus('idle', remainingQueue.length);

    if (successCount > 0) {
      window.dispatchEvent(new CustomEvent('pwa-sync-completed', { 
        detail: { successCount, failedCount } 
      }));
    }

    return { successCount, failedCount };
  }
};
