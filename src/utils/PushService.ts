/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import webpush from 'web-push';
import { loadDB, saveDB, generateUUID } from './server_db';

export class PushService {
  private static isInitialized = false;

  /**
   * Initializes the PushService by verifying VAPID keys.
   * If they are not found, they are dynamically generated and persisted.
   */
  public static initialize() {
    if (this.isInitialized) return;

    const db = loadDB();
    if (!db.vapid_keys) {
      const keys = webpush.generateVAPIDKeys();
      db.vapid_keys = {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      };
      saveDB(db);
      console.log('PushService: Successfully generated and persisted new VAPID keys.');
    }

    webpush.setVapidDetails(
      'mailto:info@ruqayyatransport.com',
      db.vapid_keys.publicKey,
      db.vapid_keys.privateKey
    );

    this.isInitialized = true;
  }

  /**
   * Returns the application VAPID public key.
   */
  public static getPublicKey(): string {
    this.initialize();
    const db = loadDB();
    return db.vapid_keys?.publicKey || '';
  }

  /**
   * Subscribes a user device.
   */
  public static subscribeUser(userId: string, subscription: any) {
    this.initialize();
    const db = loadDB();
    if (!db.push_subscriptions) {
      db.push_subscriptions = [];
    }

    const exists = db.push_subscriptions.some(
      (sub: any) => sub.user_id === userId && JSON.stringify(sub.subscription) === JSON.stringify(subscription)
    );

    if (!exists) {
      db.push_subscriptions.push({
        id: generateUUID(),
        user_id: userId,
        subscription,
        created_at: new Date().toISOString()
      });
      saveDB(db);
    }
  }

  /**
   * Unsubscribes a user device based on the endpoint URL.
   */
  public static unsubscribeUser(userId: string, endpoint: string) {
    this.initialize();
    const db = loadDB();
    if (!db.push_subscriptions) return;

    const originalLength = db.push_subscriptions.length;
    db.push_subscriptions = db.push_subscriptions.filter(
      (sub: any) => !(sub.user_id === userId && sub.subscription.endpoint === endpoint)
    );

    if (db.push_subscriptions.length !== originalLength) {
      saveDB(db);
    }
  }

  /**
   * Delivers a native push notification to a specific user.
   */
  public static async sendNotification(userId: string, payload: { title: string; body: string; [key: string]: any }) {
    this.initialize();
    const db = loadDB();
    if (!db.push_subscriptions) return { success: true, sentCount: 0, failedCount: 0 };

    const userSubs = db.push_subscriptions.filter((sub: any) => sub.user_id === userId);
    return await this.sendToSubscriptions(userSubs, payload);
  }

  /**
   * Delivers a native push notification to a list of users.
   */
  public static async sendNotificationToUsers(userIds: string[], payload: { title: string; body: string; [key: string]: any }) {
    this.initialize();
    const db = loadDB();
    if (!db.push_subscriptions) return { success: true, sentCount: 0, failedCount: 0 };

    const userSubs = db.push_subscriptions.filter((sub: any) => userIds.includes(sub.user_id));
    return await this.sendToSubscriptions(userSubs, payload);
  }

  /**
   * Broadcasts a native push notification to all subscribed devices.
   */
  public static async broadcastNotification(payload: { title: string; body: string; [key: string]: any }) {
    this.initialize();
    const db = loadDB();
    if (!db.push_subscriptions) return { success: true, sentCount: 0, failedCount: 0 };

    return await this.sendToSubscriptions(db.push_subscriptions, payload);
  }

  /**
   * Core internal helper to trigger the push requests via Web Push API and auto-prune expired/invalid registrations.
   */
  private static async sendToSubscriptions(subs: any[], payload: any) {
    const payloadStr = JSON.stringify(payload);
    let sentCount = 0;
    let failedCount = 0;
    const db = loadDB();
    let dbChanged = false;

    const promises = subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payloadStr);
        sentCount++;
      } catch (err: any) {
        console.warn(`PushService: Delivery failed for subscription ${sub.id}`, err.statusCode, err.message);
        // Prune stale or expired browser registrations
        if (err.statusCode === 410 || err.statusCode === 404) {
          if (db.push_subscriptions) {
            db.push_subscriptions = db.push_subscriptions.filter((s: any) => s.id !== sub.id);
            dbChanged = true;
          }
          failedCount++;
        }
      }
    });

    await Promise.all(promises);

    if (dbChanged) {
      saveDB(db);
    }

    return { success: true, sentCount, failedCount };
  }
}
