import re

with open('functions/api/[[path]].ts', 'r') as f:
    content = f.read()

# Replace Uint8Array.from(atob(...), ...)
old_str1 = "const buffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));"
new_str1 = """const binaryStr = atob(base64Content);
        const buffer = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          buffer[i] = binaryStr.charCodeAt(i);
        }"""
content = content.replace(old_str1, new_str1)

old_str2 = "const buffer = Uint8Array.from(atob(photo.replace(/^data:.*?;base64,/, '')), c => c.charCodeAt(0));"
new_str2 = """const b64 = photo.replace(/^data:.*?;base64,/, '');
          const binaryStr = atob(b64);
          const buffer = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            buffer[i] = binaryStr.charCodeAt(i);
          }"""
content = content.replace(old_str2, new_str2)

with open('functions/api/[[path]].ts', 'w') as f:
    f.write(content)
