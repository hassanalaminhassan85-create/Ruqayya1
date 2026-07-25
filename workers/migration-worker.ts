/**
 * Migration Worker - migrate local JSON DB dump into Cloudflare D1 `collections` table
 *
 * Usage:
 * 1. Deploy this worker (wrangler publish workers/migration-worker.ts) to your account with the D1 binding `DB` configured.
 * 2. POST the JSON DB backup as the request body to /migrate (Content-Type: application/json).
 *
 * Example (after deploy):
 *   curl -X POST "https://<your-worker-domain>/migrate" \
 *     -H "Content-Type: application/json" \
 *     --data-binary @storage/db.json.bak.2026-07-25T20-58-06Z.json
 *
 * Security note: This endpoint accepts a full DB dump and writes to D1. Protect it (IP allowlist, temporary auth token) in production.
 */

interface Env {
  DB: any; // D1 binding
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'Ruqayya Migration Worker',
        usage: 'POST your JSON DB dump to /migrate with Content-Type: application/json',
        examples: [
          'curl -X POST "https://<your-worker>/migrate" -H "Content-Type: application/json" --data-binary @storage/db.json.bak.2026-07-25T20-58-06Z.json'
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST' && url.pathname === '/migrate') {
      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (env.DB) is not configured for this worker.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      let payload: any;
      try {
        payload = await request.json();
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Invalid JSON payload. Provide the full DB dump as JSON body.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      if (typeof payload !== 'object' || Array.isArray(payload)) {
        return new Response(JSON.stringify({ error: 'Payload must be an object mapping collectionName -> arrayOrObject' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const results: any = { written: {}, errors: {} };

      for (const [name, data] of Object.entries(payload)) {
        try {
          const jsonStr = JSON.stringify(data || []);
          // Use INSERT OR REPLACE into collections(name, data) - matches the cycle-timer worker expectation
          await env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
            .bind(name, jsonStr)
            .run();
          results.written[name] = (Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 1));
        } catch (err: any) {
          results.errors[name] = err && err.message ? err.message : String(err);
        }
      }

      // Return a concise report
      return new Response(JSON.stringify({ success: true, report: results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Ruqayya Migration Worker - unsupported method or path', { status: 404 });
  }
};
