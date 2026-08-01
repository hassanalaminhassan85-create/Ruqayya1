import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import admin from 'firebase-admin';
import webpush from 'web-push';

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());

const API_KEY = process.env.MICROSERVICE_API_KEY || '';
const SA_JSON = process.env.SA_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || '';

function requireApiKey(req: any, res: any, next: any) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  const token = typeof auth === 'string' && auth.split(' ')[1];
  if (!token || token !== API_KEY) {
    console.warn('[microservice] unauthorized attempt', { path: req.path });
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Initialize firebase-admin if SA_JSON present
try {
  if (SA_JSON) {
    const serviceAccount = JSON.parse(SA_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.info('[microservice] firebase-admin initialized');
  } else {
    console.warn('[microservice] no service account provided; Firestore endpoints will fail');
  }
} catch (e) {
  console.error('[microservice] firebase-admin init error', e);
}

const firestore = admin.firestore ? admin.firestore() : null;

// DB load/save operate on collection 'system_state' doc 'main_database'
app.get('/internal/db/load', requireApiKey, async (req, res) => {
  try {
    if (!firestore) return res.status(500).json({ error: 'firestore not initialized' });
    const docRef = firestore.collection('system_state').doc('main_database');
    const doc = await docRef.get();
    if (!doc.exists) return res.json({});
    return res.json(doc.data());
  } catch (err) {
    console.error('[microservice] /internal/db/load error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/internal/db/save', requireApiKey, async (req, res) => {
  try {
    if (!firestore) return res.status(500).json({ error: 'firestore not initialized' });
    const docRef = firestore.collection('system_state').doc('main_database');
    await docRef.set(req.body || {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('[microservice] /internal/db/save error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Session validation - expects query ?token=...
app.get('/internal/session/validate', requireApiKey, async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ ok: false, reason: 'missing token' });
    if (!firestore) return res.status(500).json({ error: 'firestore not initialized' });

    const sessions = await firestore.collection('sessions').where('token', '==', token).where('status', '==', 'active').limit(1).get();
    if (sessions.empty) return res.status(403).json({ ok: false });
    const user = sessions.docs[0].data();
    return res.json({ ok: true, user });
  } catch (err) {
    console.error('[microservice] /internal/session/validate error', err);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// Push-related endpoints: keep subscriptions in 'push_subscriptions' collection
// Initialize VAPID keys if missing (in Firestore main_database.vapid_keys)
async function ensureVapid() {
  try {
    if (!firestore) return null;
    const docRef = firestore.collection('system_state').doc('main_database');
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : {};
    if (data && data.vapid_keys && data.vapid_keys.publicKey && data.vapid_keys.privateKey) {
      const keys = data.vapid_keys;
      webpush.setVapidDetails('mailto:admin@ruqayya.local', keys.publicKey, keys.privateKey);
      return keys;
    }

    const keys = webpush.generateVAPIDKeys();
    if (docRef) await docRef.set({ ...(data||{}), vapid_keys: keys }, { merge: true });
    webpush.setVapidDetails('mailto:admin@ruqayya.local', keys.publicKey, keys.privateKey);
    return keys;
  } catch (e) {
    console.error('[microservice] ensureVapid error', e);
    return null;
  }
}

app.get('/internal/push/publicKey', requireApiKey, async (req, res) => {
  try {
    const keys = await ensureVapid();
    if (!keys) return res.status(500).json({ error: 'vapid init failed' });
    return res.json({ publicKey: keys.publicKey });
  } catch (err) {
    console.error('[microservice] /internal/push/publicKey error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/internal/push/subscribe', requireApiKey, async (req, res) => {
  try {
    if (!firestore) return res.status(500).json({ error: 'firestore not initialized' });
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription) return res.status(400).json({ error: 'missing userId or subscription' });
    const col = firestore.collection('push_subscriptions');
    await col.add({ userId, subscription, created_at: new Date().toISOString() });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[microservice] /internal/push/subscribe error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

app.post('/internal/push/send', requireApiKey, async (req, res) => {
  try {
    const { userId, payload } = req.body || {};
    if (!payload) return res.status(400).json({ error: 'missing payload' });
    const keys = await ensureVapid();
    if (!keys) return res.status(500).json({ error: 'vapid init failed' });
    if (!firestore) return res.status(500).json({ error: 'firestore not initialized' });

    let query = firestore.collection('push_subscriptions');
    if (userId) query = query.where('userId', '==', userId);
    const subsSnap = await query.get();
    const results: any[] = [];
    const promises: Promise<any>[] = [];

    subsSnap.forEach(doc => {
      const s = doc.data();
      const subscription = s.subscription;
      promises.push(webpush.sendNotification(subscription, JSON.stringify(payload)).then(() => ({ ok: true })).catch((e:any) => ({ ok: false, error: e && e.stack || e })) );
    });

    const settled = await Promise.all(promises);
    return res.json({ results: settled });
  } catch (err) {
    console.error('[microservice] /internal/push/send error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// health
app.get('/_health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.info(`[microservice] listening on ${PORT}`));
