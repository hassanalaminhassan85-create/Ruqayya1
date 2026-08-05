const crypto = require('crypto');
const base64 = crypto.randomBytes(500 * 1024).toString('base64');
const start = performance.now();
const str = atob(base64);
const bytes = Uint8Array.from(str, c => c.charCodeAt(0));
console.log("Uint8Array.from took:", performance.now() - start, "ms");

const start2 = performance.now();
const str2 = atob(base64);
const bytes2 = new Uint8Array(str2.length);
for (let i = 0; i < str2.length; i++) {
    bytes2[i] = str2.charCodeAt(i);
}
console.log("For loop took:", performance.now() - start2, "ms");
