export default {
  async fetch(request: Request, env: { DB: any; MIGRATE_TOKEN?: string }) {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'preview'; // preview or apply

      const provided = request.headers.get('x-migrate-token') || '';
      if (!env.MIGRATE_TOKEN || provided !== env.MIGRATE_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Remote raw URLs (public repo)
      const baseRaw = 'https://raw.githubusercontent.com/hassanalaminhassan85-create/Ruqayya1/main/sql';
      const schemaUrl = `${baseRaw}/normalized-schema.sql`;
      const importUrl = `${baseRaw}/normalized-import.sql`;

      const [schemaResp, importResp] = await Promise.all([fetch(schemaUrl), fetch(importUrl)]);
      if (!schemaResp.ok) return new Response(JSON.stringify({ error: 'Failed to fetch schema.sql', status: schemaResp.status }), { status: 502 });
      if (!importResp.ok) return new Response(JSON.stringify({ error: 'Failed to fetch normalized-import.sql', status: importResp.status }), { status: 502 });

      const schemaSql = await schemaResp.text();
      const importSql = await importResp.text();

      function splitStatements(sql: string) {
        return sql
          .split(/;\s*\n/) // split on semicolon+newline to be safer
          .map(s => s.trim())
          .filter(s => s && s.length > 0);
      }

      const schemaStmts = splitStatements(schemaSql);
      const importStmts = splitStatements(importSql);

      if (action === 'preview') {
        return new Response(JSON.stringify({ preview: true, schemaStatements: schemaStmts.length, importStatements: importStmts.length, sampleSchema: schemaStmts.slice(0,5), sampleImport: importStmts.slice(0,5) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (action === 'apply') {
        // compute a simple checksum of importSql
        const enc = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(importSql));
        const hashArray = Array.from(new Uint8Array(hashBuf));
        const sha = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // ensure migrations table exists
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, sql_sha TEXT, applied_at TEXT)`).run();

        // check if sha already applied
        const already = await env.DB.prepare('SELECT sql_sha FROM migrations WHERE sql_sha = ?').bind(sha).all();
        if (already && ((already.results && already.results.length) || (Array.isArray(already) && already.length))) {
          return new Response(JSON.stringify({ applied: false, reason: 'Already applied', sql_sha: sha }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Execute schema statements first
        const results: any[] = [];
        for (const stmt of schemaStmts) {
          try {
            await env.DB.prepare(stmt).run();
            results.push({ statement: stmt.slice(0,200), status: 'ok' });
          } catch (e: any) {
            results.push({ statement: stmt.slice(0,200), status: 'error', error: e?.message || String(e) });
            return new Response(JSON.stringify({ applied: false, error: 'schema execution failed', details: results }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }

        // Execute import statements
        for (const stmt of importStmts) {
          try {
            await env.DB.prepare(stmt).run();
            results.push({ statement: stmt.slice(0,200), status: 'ok' });
          } catch (e: any) {
            results.push({ statement: stmt.slice(0,200), status: 'error', error: e?.message || String(e) });
            return new Response(JSON.stringify({ applied: false, error: 'import execution failed', details: results }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }

        // record migration
        const id = 'mig-' + Date.now();
        await env.DB.prepare('INSERT OR REPLACE INTO migrations (id, sql_sha, applied_at) VALUES (?, ?, ?)').bind(id, sha, new Date().toISOString()).run();

        return new Response(JSON.stringify({ applied: true, sql_sha: sha, statements_executed: results.length, sample_results: results.slice(0,10) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'unknown action (use ?action=preview or ?action=apply)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
