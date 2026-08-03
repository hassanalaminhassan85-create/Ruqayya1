import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

delete_docs = """
  if (path.startsWith('/api/documents/') && method === 'DELETE') {
    try {
      if (user.role !== 'admin' && user.role !== 'director') return buildResponse({ error: 'Access Denied.' }, 403);
      const parts = path.replace(/^\/api\/documents\//, '').split('/').filter(Boolean);
      if (parts.length === 2) {
        const category = parts[0];
        const documentId = parts[1];
        let found = false;
        if (category === 'company') {
          const initialLength = db.company_documents.length;
          db.company_documents = db.company_documents.filter((d: any) => d.id !== documentId);
          if (db.company_documents.length < initialLength) found = true;
        } else if (category === 'driver') {
          const initialLength = db.driver_documents.length;
          db.driver_documents = db.driver_documents.filter((d: any) => d.id !== documentId);
          if (db.driver_documents.length < initialLength) found = true;
        } else if (category === 'vehicle') {
          const initialLength = db.vehicle_documents.length;
          db.vehicle_documents = db.vehicle_documents.filter((d: any) => d.id !== documentId);
          if (db.vehicle_documents.length < initialLength) found = true;
        }
        
        if (!found) return buildResponse({ error: 'Document not found.' }, 404);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Document deleted successfully.' });
      }
    } catch (err: any) { return buildResponse({ error: err.message }, 500); }
  }
"""

if "method === 'DELETE'" not in content.split("15. DYNAMIC MODULES")[0]:
    content = content.replace("  // 15. DYNAMIC MODULES", delete_docs + "\n  // 15. DYNAMIC MODULES")

with open(file_path, 'w') as f:
    f.write(content)
print("Delete docs patch applied!")
