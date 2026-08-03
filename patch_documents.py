import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

docs_missing = """
  // 14.2. POST /api/documents/replace
  if (path === '/api/documents/replace' && method === 'POST') {
    try {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      const { category, documentId, fileBase64, filename } = await request.json() as any;
      if (!env.R2_BUCKET) return buildResponse({ error: 'R2 not configured' }, 500);
      
      const fileId = `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
      const ext = filename.split('.').pop();
      const savedName = `${fileId}.${ext}`;
      
      const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
      const binaryString = atob(cleanBase64);
      const buffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) buffer[i] = binaryString.charCodeAt(i);
      
      await env.R2_BUCKET.put(savedName, buffer, { httpMetadata: { contentType: `image/${ext}` } });
      const fileUrl = `/api/documents/preview/${savedName}`;
      
      let found = false;
      if (category === 'company') {
        const doc = db.company_documents.find((d: any) => d.id === documentId);
        if (doc) { doc.file_url = fileUrl; doc.uploaded_at = new Date().toISOString(); found = true; }
      } else if (category === 'driver') {
        const doc = db.driver_documents.find((d: any) => d.id === documentId);
        if (doc) { doc.file_url = fileUrl; doc.uploaded_at = new Date().toISOString(); found = true; }
      } else if (category === 'vehicle') {
        const doc = db.vehicle_documents.find((d: any) => d.id === documentId);
        if (doc) { doc.file_url = fileUrl; doc.uploaded_at = new Date().toISOString(); found = true; }
      }
      
      if (!found) return buildResponse({ error: 'Document not found.' }, 404);
      await dbManager.saveDB(db);
      return buildResponse({ success: true, message: 'Document replaced successfully.', file_url: fileUrl });
    } catch (err: any) { return buildResponse({ error: err.message }, 500); }
  }
"""

if "path === '/api/documents/replace'" not in content:
    content = content.replace("  // 15. DYNAMIC MODULES", docs_missing + "\n  // 15. DYNAMIC MODULES")

with open(file_path, 'w') as f:
    f.write(content)
print("Documents patch applied!")
