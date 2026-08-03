const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// 1. New Company Cycle Commenced
content = content.replace(/title_en: 'New Company Cycle Commenced',/g, "target_roles: ['admin', 'director'],\n      title_en: 'New Company Cycle Commenced',");

// 2. Shareholder Distribution Percentage Modified
content = content.replace(/title_en: 'Shareholder Distribution Percentage Modified',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Shareholder Distribution Percentage Modified',");

// 3. New Driver Payment Submitted
content = content.replace(/title_en: 'New Driver Payment Submitted',/g, "target_roles: ['admin', 'director'],\n      title_en: 'New Driver Payment Submitted',");

// 4. Corporate Expense Recorded
content = content.replace(/title_en: 'Corporate Expense Recorded',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Corporate Expense Recorded',");

// 5. Shareholder Withdrawal Processed
content = content.replace(/title_en: 'Shareholder Withdrawal Processed',/g, "user_id: sh.user_id,\n      title_en: 'Shareholder Withdrawal Processed',");

// 6. Shareholder Reinvestment Processed
content = content.replace(/title_en: 'Shareholder Reinvestment Processed',/g, "user_id: sh.user_id,\n      title_en: 'Shareholder Reinvestment Processed',");

// 7. Capital Stock Redemption Processed
content = content.replace(/title_en: 'Capital Stock Redemption Processed',/g, "user_id: sh.user_id,\n      title_en: 'Capital Stock Redemption Processed',");

// 8. Payroll Successfully Processed
content = content.replace(/title_en: 'Payroll Successfully Processed',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Payroll Successfully Processed',");

// 9. Paper Record Imported Successfully
content = content.replace(/title_en: 'Paper Record Imported Successfully',/g, "target_roles: ['admin', 'director'],\n      title_en: 'Paper Record Imported Successfully',");

// 10. New System Document Archived
content = content.replace(/title_en: 'New System Document Archived',/g, "target_roles: ['admin', 'director'],\n      title_en: 'New System Document Archived',");

// 11. New Self-Registered Driver Candidate
content = content.replace(/title_en: 'New Self-Registered Driver Candidate',/g, "target_roles: ['admin', 'director'],\n      title_en: 'New Self-Registered Driver Candidate',");

fs.writeFileSync('server.ts', content);
