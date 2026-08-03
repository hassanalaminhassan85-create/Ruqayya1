const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/if \(withdrawAmt > availableWithdrawal\) \{([\s\S]*?)prevented([\s\S]*?)\}/g, `// $1`);
content = content.replace(/if \(capOutAmt > currentInvestment\) \{([\s\S]*?)exceeds([\s\S]*?)\}/g, `// $1`);
content = content.replace(/if \(reinvestAmt > availableWithdrawal\) \{([\s\S]*?)prevented([\s\S]*?)\}/g, `// $1`);

fs.writeFileSync('server.ts', content);
