/**
 * Migration Worker - migrate local JSON DB dump into Cloudflare D1 `collections` table
 *
 * Usage:
 * 1. Deploy this worker (wrangler publish workers/migration-worker.ts) to your account with the D1 binding `DB` configured.
 * 2. POST the JSON DB backup as the request body to /migrate (Content-Type: application/json).
 *
 * Security: This worker supports a MIGRATE_TOKEN environment variable. When set, callers
 * must send header `X-MIGRATE-TOKEN: <token>` or the request will be rejected (401).
 *
 * Debug: GET /debug returns a concise list of collection names and item counts from D1.
 */

interface Env {
  DB: any; // D1 binding
  MIGRATE_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const pathname = url.pathname || '/';

    // Simple health root
    if (request.method === 'GET' && pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Ruqayya Migration Worker',
        usage: 'POST your JSON DB dump to /migrate with Content-Type: application/json',
        notes: 'Use GET /debug to inspect D1 collection counts (protected endpoint if MIGRATE_TOKEN is set)'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Debug endpoint: lists collections and counts
    if (request.method === 'GET' && pathname === '/debug') {
      // If MIGRATE_TOKEN is configured, require it for debug as well
      if (env.MIGRATE_TOKEN) {
        const provided = request.headers.get('x-migrate-token') || '';
        if (!provided || provided !== env.MIGRATE_TOKEN) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
      }

      if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 binding (env.DB) is not configured for this worker.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const resp = await env.DB.prepare('SELECT name, data FROM collections').all();
        const rows = (resp && (resp.results || resp)) || [];
        const out: Record<string, number> = {};
        for (const row of rows) {
          try {
            const data = JSON.parse(row.data || 'null');
            if (Array.isArray(data)) out[row.name] = data.length;
            else if (data && typeof data === 'object') out[row.name] = Object.keys(data).length;
            else out[row.name] = data ? 1 : 0;
          } catch (e) {
            out[row.name] = -1; // parse error
          }
        }
        return new Response(JSON.stringify({ success: true, collections: out }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err && err.message ? err.message : String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Migration endpoint
    if (request.method === 'POST' && pathname === '/migrate') {
      // Require token when configured
      if (env.MIGRATE_TOKEN) {
        const provided = request.headers.get('x-migrate-token') || '';
        if (!provided || provided !== env.MIGRATE_TOKEN) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
      }

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
          await env.DB.prepare("INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)")
            .bind(name, jsonStr)
            .run();
          results.written[name] = (Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 1));
        } catch (err: any) {
          results.errors[name] = err && err.message ? err.message : String(err);
        }
      }

      return new Response(JSON.stringify({ success: true, report: results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Ruqayya Migration Worker - unsupported method or path', { status: 404 });
  }
};
