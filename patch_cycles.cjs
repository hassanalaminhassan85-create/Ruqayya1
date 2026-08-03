const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// 1. Operating Cycle Concluded
content = content.replace(/title_en: 'Operating Cycle Concluded',/g, "target_roles: ['admin', 'director'],\n          title_en: 'Operating Cycle Concluded',");

// 2. Operating Cycle Paused
content = content.replace(/title_en: 'Operating Cycle Paused',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Operating Cycle Paused',");

// 3. Operating Cycle Permanently Deleted
content = content.replace(/title_en: 'Operating Cycle Permanently Deleted',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Operating Cycle Permanently Deleted',");

// 4. Operating Cycle Resumed
content = content.replace(/title_en: 'Operating Cycle Resumed',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Operating Cycle Resumed',");

// 5. Operating Cycle Completed & Locked + per-user notifications
const oldCycleCompleted = `    // Notify of cycle completion
    db.notifications.unshift({
      id: generateUUID(),
      title_en: 'Operating Cycle Completed & Locked',
      title_ha: 'An Kammala Kuma An Rufe Zagayen Sufuri',
      message_en: \`Operation Cycle \${closedCycle.id} has ended. Net profit: ₦\${netGeneratedAmount.toLocaleString()}. Shareholder pool: ₦\${distributionPool.toLocaleString()}.\`,
      message_ha: \`Zagayen aiki \${closedCycle.id} ya kare. Ribar kudi: ₦\${netGeneratedAmount.toLocaleString()}. Kudin Masu Hannun Jari: ₦\${distributionPool.toLocaleString()}.\`,
      type: 'info',
      read_status: 0,
      created_at: new Date().toISOString()
    });`;

const newCycleCompleted = `    // Notify of cycle completion to admins/directors
    db.notifications.unshift({
      id: generateUUID(),
      target_roles: ['admin', 'director'],
      title_en: 'Operating Cycle Completed & Locked',
      title_ha: 'An Kammala Kuma An Rufe Zagayen Sufuri',
      message_en: \`Operation Cycle \${closedCycle.id} has ended. Net profit: ₦\${netGeneratedAmount.toLocaleString()}. Shareholder pool: ₦\${distributionPool.toLocaleString()}.\`,
      message_ha: \`Zagayen aiki \${closedCycle.id} ya kare. Ribar kudi: ₦\${netGeneratedAmount.toLocaleString()}. Kudin Masu Hannun Jari: ₦\${distributionPool.toLocaleString()}.\`,
      type: 'info',
      read_status: 0,
      created_at: new Date().toISOString()
    });
    
    // Notify Shareholders
    shareholderSummary.forEach(sh => {
      if (sh.dividendAmount > 0) {
        const targetSh = db.shareholders.find(s => s.id === sh.shareholderId);
        if (targetSh && targetSh.user_id) {
          db.notifications.unshift({
            id: generateUUID(),
            user_id: targetSh.user_id,
            title_en: 'Cycle Dividend Allocated',
            title_ha: 'An Ware Ribar Jari',
            message_en: \`Cycle \${closedCycle.id} has ended. Your dividend allocation is ₦\${sh.dividendAmount.toLocaleString()}.\`,
            message_ha: \`Zagayen \${closedCycle.id} ya kare. Ribar da kake da ita shine ₦\${sh.dividendAmount.toLocaleString()}.\`,
            type: 'success',
            read_status: 0,
            created_at: new Date().toISOString()
          });
        }
      }
    });

    // Notify Drivers
    driverPaymentSummary.forEach(dps => {
      const targetDriver = db.drivers.find(d => d.id === dps.driverId);
      if (targetDriver && targetDriver.user_id) {
        db.notifications.unshift({
          id: generateUUID(),
          user_id: targetDriver.user_id,
          title_en: 'Cycle Performance Summary',
          title_ha: 'Takaitaccen Aikin Zagaye',
          message_en: \`Cycle \${closedCycle.id} ended. You paid ₦\${dps.totalPaid.toLocaleString()} of your ₦\${dps.agreedAmount.toLocaleString()} target.\`,
          message_ha: \`Zagayen \${closedCycle.id} ya kare. Ka biya ₦\${dps.totalPaid.toLocaleString()} daga cikin ₦\${dps.agreedAmount.toLocaleString()} da aka amince.\`,
          type: 'info',
          read_status: 0,
          created_at: new Date().toISOString()
        });
      }
    });`;

content = content.replace(oldCycleCompleted, newCycleCompleted);

fs.writeFileSync('server.ts', content);
