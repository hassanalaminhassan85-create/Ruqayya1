const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Vehicle document expiration
content = content.replace(/vehicle_plate: vehicle.plate_number \|\| vehicle.plateNumber,\n              document_type: doc.key,/g, "target_roles: ['admin', 'director'],\n              vehicle_plate: vehicle.plate_number || vehicle.plateNumber,\n              document_type: doc.key,");

// Oil Change Maintenance Required
content = content.replace(/vehicle_plate: vehicle.plate_number \|\| vehicle.plateNumber,\n            title_en: 'Oil Change Maintenance Required',/g, "target_roles: ['admin', 'director'],\n            vehicle_plate: vehicle.plate_number || vehicle.plateNumber,\n            title_en: 'Oil Change Maintenance Required',");

// Overdue penalty
content = content.replace(/driver_id: driver.id, title_en: 'Installment Overdue'/g, "user_id: driver.user_id, driver_id: driver.id, title_en: 'Installment Overdue'");

fs.writeFileSync('server.ts', content);
