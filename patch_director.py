import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

director_missing = """
    if (ctrl === 'shareholders' && method === 'PUT') {
      return buildResponse({ error: 'Use /api/shareholders/:id endpoints directly' }, 400);
    }
    
    // Direct matches for missing server.ts /api/director endpoints:
    if (ctrl.startsWith('shareholders/') && ctrl.endsWith('/status') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const { status } = await request.json() as any;
        const sh = db.shareholders.find((s: any) => s.id === id);
        if (sh) {
          sh.status = status;
          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_STATUS_UPDATE', id, `Status updated to ${status}`, db);
          await dbManager.saveDB(db);
          return buildResponse({ success: true });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    
    if (ctrl.startsWith('shareholders/') && ctrl.endsWith('/investment') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const { total_investment } = await request.json() as any;
        const sh = db.shareholders.find((s: any) => s.id === id);
        if (sh) {
          sh.total_investment = total_investment;
          writeAuditLog(user.id, user.email, user.role, 'SHAREHOLDER_INVESTMENT_UPDATE', id, `Investment updated to ${total_investment}`, db);
          await dbManager.saveDB(db);
          return buildResponse({ success: true });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
"""

if "ctrl.startsWith('shareholders/')" not in content:
    content = content.replace("if (ctrl === 'shareholder-settings' && method === 'PUT') {", director_missing + "    if (ctrl === 'shareholder-settings' && method === 'PUT') {")

with open(file_path, 'w') as f:
    f.write(content)
print("Director patches applied!")
