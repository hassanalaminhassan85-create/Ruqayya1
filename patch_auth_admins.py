import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

auth_admin_director = """
  if (path === '/api/auth/register-admin' && method === 'POST') {
    try {
      if (user.role !== 'director' && user.role !== 'admin') return buildResponse({ error: 'Access Denied.' }, 403);
      const { full_name, email, phone, password, pin } = await request.json() as any;
      if (!full_name || !email || !password || !pin) return buildResponse({ error: 'Missing required fields' }, 400);
      if (db.users.some((u: any) => u.email === email)) return buildResponse({ error: 'Email already in use.' }, 400);
      
      const hashedPassword = await generateHash(password);
      const hashedPin = await generateHash(pin);
      
      const newAdmin = {
        id: `ADM-${Date.now()}`,
        full_name, email, phone: phone || '', role: 'admin',
        password_hash: hashedPassword, pin_hash: hashedPin,
        status: 'active',
        created_at: new Date().toISOString()
      };
      db.users.push(newAdmin);
      writeAuditLog(user.id, user.email, user.role, 'ADMIN_REGISTERED', newAdmin.id, `Admin ${full_name} registered`, db);
      await dbManager.saveDB(db);
      return buildResponse({ success: true, user: { id: newAdmin.id, full_name, email, role: 'admin' } });
    } catch (err: any) { return buildResponse({ error: err.message }, 500); }
  }

  if (path === '/api/auth/register-director' && method === 'POST') {
    try {
      if (user.role !== 'director') return buildResponse({ error: 'Access Denied. Only Executive Director can create Directors.' }, 403);
      const { full_name, email, phone, password, pin } = await request.json() as any;
      if (!full_name || !email || !password || !pin) return buildResponse({ error: 'Missing required fields' }, 400);
      if (db.users.some((u: any) => u.email === email)) return buildResponse({ error: 'Email already in use.' }, 400);
      
      const hashedPassword = await generateHash(password);
      const hashedPin = await generateHash(pin);
      
      const newDirector = {
        id: `DIR-${Date.now()}`,
        full_name, email, phone: phone || '', role: 'director',
        password_hash: hashedPassword, pin_hash: hashedPin,
        status: 'active',
        created_at: new Date().toISOString()
      };
      db.users.push(newDirector);
      writeAuditLog(user.id, user.email, user.role, 'DIRECTOR_REGISTERED', newDirector.id, `Director ${full_name} registered`, db);
      await dbManager.saveDB(db);
      return buildResponse({ success: true, user: { id: newDirector.id, full_name, email, role: 'director' } });
    } catch (err: any) { return buildResponse({ error: err.message }, 500); }
  }
"""

if "path === '/api/auth/register-admin'" not in content:
    content = content.replace("  // 7. DIRECTORY ENDPOINTS", auth_admin_director + "\n  // 7. DIRECTORY ENDPOINTS")

with open(file_path, 'w') as f:
    f.write(content)
print("Auth admin patch applied!")
