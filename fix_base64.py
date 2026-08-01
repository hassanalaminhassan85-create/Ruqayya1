import re

with open('functions/api/[[path]].ts', 'r') as f:
    content = f.read()

# Add import if missing
if "import { Buffer } from 'node:buffer';" not in content:
    content = "import { Buffer } from 'node:buffer';\n" + content

# Replace Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
content = content.replace(
    "Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0))",
    "new Uint8Array(Buffer.from(cleanBase64, 'base64'))"
)

# Replace the for loop at 2985
# const binaryString = atob(cleanBase64);
# const len = binaryString.length;
# const bytes = new Uint8Array(len);
# for (let i = 0; i < len; i++) {
#   bytes[i] = binaryString.charCodeAt(i);
# }
# const buffer = bytes;

pattern = r"const\s+binaryString\s*=\s*atob\(([^)]+)\);\s*const\s+len\s*=\s*binaryString\.length;\s*const\s+bytes\s*=\s*new\s+Uint8Array\(len\);\s*for\s*\([^}]+\}\s*(const\s+buffer\s*=\s*bytes;|\s*)"
replacement = r"const buffer = new Uint8Array(Buffer.from(\1, 'base64'));"
content = re.sub(pattern, replacement, content)

with open('functions/api/[[path]].ts', 'w') as f:
    f.write(content)

