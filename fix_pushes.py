import re

with open('functions/api/[[path]].ts', 'r') as f:
    content = f.read()

pattern = r"sendPushForNotification\(this\.env,\s*state,\s*n\)\.catch\(\(err:\s*any\)\s*=>\s*\{\s*console\.error\([^\)]+\);\s*\}\);"
replacement = r"await sendPushForNotification(this.env, state, n).catch((err: any) => { console.error(\"Failed to dispatch push notification in saveDB:\", err); });"

new_content = re.sub(pattern, replacement, content)

with open('functions/api/[[path]].ts', 'w') as f:
    f.write(new_content)

