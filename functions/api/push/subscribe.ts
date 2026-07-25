/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface Env {
  DB: any;
  ruqayya?: any;
  PUSH_SUBSCRIPTIONS?: any;
}

const buildResponse = (data: any, status = 200, headers = {}) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
      ...headers
    }
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  
  try {
    const { subscription } = await request.json() as any;
    if (!subscription || !subscription.endpoint) {
      return buildResponse({ error: 'Invalid push subscription payload.' }, 400);
    }

    // Connect to D1 database to authenticate the user token if provided
    let userId = 'anonymous';
    const authHeader = request.headers.get('authorization');
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      const d1 = env.DB || env.ruqayya;
      
      if (d1 && token) {
        try {
          // Query session data from D1 collections
          const dbRes = await d1.prepare("SELECT data FROM collections WHERE name = 'sessions'").first("data");
          const usersRes = await d1.prepare("SELECT data FROM collections WHERE name = 'users'").first("data");
          
          if (dbRes && usersRes) {
            const sessions = JSON.parse(dbRes as string) || [];
            const users = JSON.parse(usersRes as string) || [];
            
            const session = sessions.find((s: any) => s.token === token && s.status === 'active');
            if (session && new Date(session.expires_at) >= new Date()) {
              const user = users.find((u: any) => u.id === session.user_id);
              if (user) {
                userId = user.id;
              }
            }
          }
        } catch (dbErr) {
          console.warn("Pages Function: DB retrieval failed during subscription auth:", dbErr);
        }
      }
    }

    // 1. Persist inside D1 central storage (collections.push_subscriptions)
    const d1 = env.DB || env.ruqayya;
    if (d1) {
      try {
        let pushSubs: any[] = [];
        const subsRes = await d1.prepare("SELECT data FROM collections WHERE name = 'push_subscriptions'").first("data");
        if (subsRes) {
          pushSubs = JSON.parse(subsRes as string) || [];
        }
        // Remove duplicate endpoints
        pushSubs = pushSubs.filter((s: any) => s && s.subscription && s.subscription.endpoint !== subscription.endpoint);
        pushSubs.push({
          userId,
          subscription,
          createdAt: new Date().toISOString()
        });
        // Save back to D1
        await d1.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
          .bind('push_subscriptions', JSON.stringify(pushSubs))
          .run();
      } catch (dbErr) {
        console.error("Pages Function: Failed to save subscription to D1:", dbErr);
      }
    }

    // 2. Persist subscription inside Cloudflare KV Store
    if (env.PUSH_SUBSCRIPTIONS) {
      const kvKey = `sub:${userId}:${encodeURIComponent(subscription.endpoint)}`;
      await env.PUSH_SUBSCRIPTIONS.put(kvKey, JSON.stringify(subscription));
      return buildResponse({ 
        success: true, 
        message: 'Push subscription stored successfully in DB & KV.',
        userId
      });
    } else {
      console.warn("Pages Function: PUSH_SUBSCRIPTIONS KV namespace is not configured. Saved to D1 only.");
      return buildResponse({ 
        success: true, 
        message: 'Push subscription stored successfully in D1 DB.',
        userId
      });
    }
  } catch (err: any) {
    console.error("Pages Function: Push subscribe endpoint error:", err);
    return buildResponse({ error: err.message }, 500);
  }
};

// Handle OPTIONS requests preflight
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }
  });
};
