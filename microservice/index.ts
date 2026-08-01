// Simple microservice for Node runtime to host stateful endpoints used by Edge functions
// Endpoints:
// GET  /_health
// GET  /internal/push/publicKey
// POST /internal/push/subscribe
// POST /internal/push/unsubscribe
// POST /internal/push/send
// GET  /internal/db/load
// POST /internal/db/save

import express from 'express';
import bodyParser from 'body-parser';
import { loadDB, saveDB, generateUUID, hashPassword, verifyPassword, initCloudPersistence } from '../src/utils/server_db';
import { PushService as LocalPushService } from '../src/utils/PushService';

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const API_KEY = process.env.MICROSERVICE_API_KEY || '';

function checkAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers['authorization'] || '';
  if (!API_KEY) return res.status(403).json({ error: 'MICROSERVICE_API_KEY not configured on microservice' });
  if (!auth || String(auth).replace('Bearer ', '').trim() !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.get('/_health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// DB endpoints
app.get('/internal/db/load', checkAuth, (req, res) => {
  try {
    const db = loadDB();
    res.json({ success: true, db });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/internal/db/save', checkAuth, (req, res) => {
  try {
    const { db } = req.body;
    if (!db) return res.status(400).json({ error: 'Missing db payload' });
    saveDB(db);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Push endpoints (use local PushService implementation) - simple wrappers
app.get('/internal/push/publicKey', checkAuth, async (req, res) => {
  try {
    await LocalPushService.initialize();
    const key = await LocalPushService.getPublicKey();
    res.json({ success: true, publicKey: key });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/internal/push/subscribe', checkAuth, async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Missing subscription' });
    await LocalPushService.subscribeUser(userId || 'anonymous', subscription);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/internal/push/unsubscribe', checkAuth, async (req, res) => {
  try {
    const { userId, endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await LocalPushService.unsubscribeUser(userId || 'anonymous', endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/internal/push/send', checkAuth, async (req, res) => {
  try {
    const { userId, userIds, payload } = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    if (userId) {
      const r = await LocalPushService.sendNotification(userId, payload);
      return res.json(r);
    }
    if (Array.isArray(userIds)) {
      const r = await LocalPushService.sendNotificationToUsers(userIds, payload);
      return res.json(r);
    }
    const r = await LocalPushService.broadcastNotification(payload);
    res.json(r);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = parseInt(process.env.PORT || '3001', 10);
initCloudPersistence().catch(() => {});
app.listen(PORT, () => {
  console.log(`Microservice listening on port ${PORT}`);
});
