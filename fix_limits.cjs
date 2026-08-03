const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/\/\/\s*return res\.status\(400\)\.json\(\{ error: `Over-withdrawal ` \}\);\n\s*\}/g, ``);
content = content.replace(/\/\/\s*return res\.status\(400\)\.json\(\{ error: `Redemption amount ` \}\);\n\s*\}/g, ``);
content = content.replace(/\/\/\s*return res\.status\(400\)\.json\(\{ error: `Over-reinvestment ` \}\);\n\s*\}/g, ``);

fs.writeFileSync('server.ts', content);
