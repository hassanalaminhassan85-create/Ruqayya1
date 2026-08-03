import re

file_path = 'functions/api/[[path]].ts'
with open(file_path, 'r') as f:
    content = f.read()

director_admins = """
    if (ctrl === 'admins' && method === 'POST') {
      try {
        const { full_name, email, password, pin } = await request.json() as any;
        if (db.users.some((u: any) => u.email === email)) return buildResponse({ error: 'Email already exists' }, 400);
        const hashedPassword = await generateHash(password);
        const hashedPin = await generateHash(pin);
        const newAdmin = { id: `ADM-${Date.now()}`, full_name, email, role: 'admin', password_hash: hashedPassword, pin_hash: hashedPin, status: 'active', created_at: new Date().toISOString() };
        db.users.push(newAdmin);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Admin created' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (ctrl.startsWith('admins/') && method === 'PUT') {
      try {
        const id = ctrl.split('/')[1];
        const updates = await request.json() as any;
        const admin = db.users.find((u: any) => u.id === id);
        if (admin) {
          if (updates.full_name) admin.full_name = updates.full_name;
          if (updates.email) admin.email = updates.email;
          if (updates.password) admin.password_hash = await generateHash(updates.password);
          if (updates.pin) admin.pin_hash = await generateHash(updates.pin);
          if (updates.status) admin.status = updates.status;
          await dbManager.saveDB(db);
          return buildResponse({ success: true, message: 'Admin updated' });
        }
        return buildResponse({ error: 'Not found' }, 404);
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
    if (ctrl.startsWith('admins/') && method === 'DELETE') {
      try {
        const id = ctrl.split('/')[1];
        db.users = db.users.filter((u: any) => u.id !== id);
        await dbManager.saveDB(db);
        return buildResponse({ success: true, message: 'Admin deleted' });
      } catch (err: any) { return buildResponse({ error: err.message }, 500); }
    }
"""

if "ctrl === 'admins' && method === 'POST'" not in content:
    content = content.replace("    if (ctrl === 'cycles' && method === 'GET') {", director_admins + "\n    if (ctrl === 'cycles' && method === 'GET') {")

with open(file_path, 'w') as f:
    f.write(content)
print("Director admins patch applied!")
