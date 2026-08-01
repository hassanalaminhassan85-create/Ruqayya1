export async function onRequest(context: any) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  try {
    const url = new URL(request.url);
    const pathname = url.pathname || '';
    const parts = pathname.split('/').filter(Boolean);
    // expect path like /api/documents/preview/<filename>
    const filename = parts[parts.length - 1];
    if (!filename) return new Response('Bad request', { status: 400 });

    const token = url.searchParams.get('token');
    if (!token) {
      console.warn('[preview] missing token');
      return new Response('Forbidden: token required', { status: 403 });
    }

    // Validate token using microservice
    const msUrl = (env.MICROSERVICE_URL || '').replace(/\/+$/, '');
    if (!msUrl) {
      console.error('[preview] missing MICROSERVICE_URL binding');
      return new Response('Server misconfigured', { status: 500 });
    }

    const validateResp = await fetch(`${msUrl}/internal/session/validate?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${env.MICROSERVICE_API_KEY || ''}` }
    });

    if (!validateResp.ok) {
      console.warn('[preview] token validation failed', { status: validateResp.status });
      return new Response('Forbidden', { status: 403 });
    }

    // Retrieve object from R2 binding named R2_BUCKET
    if (!env.R2_BUCKET) {
      console.error('[preview] missing R2_BUCKET binding');
      return new Response('Server misconfigured', { status: 500 });
    }

    const obj = await env.R2_BUCKET.get(filename);
    if (!obj) return new Response('Not found', { status: 404 });

    const contentType = obj.httpMetadata?.contentType || (filename.endsWith('.pdf') ? 'application/pdf' : filename.match(/\.jpe?g$/i) ? 'image/jpeg' : 'image/png');

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    console.error('[preview] error', err && err.stack || err);
    return new Response('File rendering fault.', { status: 500 });
  }
}
