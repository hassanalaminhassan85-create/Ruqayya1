const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace target_role push notification logic
const pushSearch = `    } else if (n.target_role) {
      const roles = db.roles.filter(r => r.name === n.target_role);
      const roleIds = roles.map(r => r.id);
      const usersWithRole = db.users.filter(u => roleIds.includes(u.role_id));
      targetUserIds = usersWithRole.map(u => u.id);
    }`;

const pushReplace = `    } else if (n.target_roles && Array.isArray(n.target_roles)) {
      const roles = db.roles.filter(r => n.target_roles.includes(r.name));
      const roleIds = roles.map(r => r.id);
      const usersWithRole = db.users.filter(u => roleIds.includes(u.role_id));
      targetUserIds = usersWithRole.map(u => u.id);
    } else if (n.target_role) {
      const roles = db.roles.filter(r => r.name === n.target_role);
      const roleIds = roles.map(r => r.id);
      const usersWithRole = db.users.filter(u => roleIds.includes(u.role_id));
      targetUserIds = usersWithRole.map(u => u.id);
    }`;

content = content.replace(pushSearch, pushReplace);

const broadcastSearch = `} else if (!n.user_id && !n.driver_id && !n.admin_id && !n.target_role) {`;
const broadcastReplace = `} else if (!n.user_id && !n.driver_id && !n.admin_id && !n.target_role && (!n.target_roles || n.target_roles.length === 0)) {`;

content = content.replace(broadcastSearch, broadcastReplace);

fs.writeFileSync('server.ts', content);
