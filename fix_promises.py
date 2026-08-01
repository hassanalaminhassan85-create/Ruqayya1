import re

with open('functions/api/[[path]].ts', 'r') as f:
    content = f.read()

# Replace hashPassword(...).then(async (h) => { ... await dbManager.saveDB(db); });
# with awaiting hashPassword directly
pattern = r"hashPassword\(([^)]+)\)\.then\(async\s*\(\w+\)\s*=>\s*\{\s*user\.password_hash\s*=\s*\w+;\s*await\s*dbManager\.saveDB\(db\);\s*\}\);"
replacement = r"user.password_hash = await hashPassword(\1);\n              await dbManager.saveDB(db);"

new_content = re.sub(pattern, replacement, content)

# Also fix dbManager.saveDB(db); // non-blocking or concurrently handled save
new_content = new_content.replace(
    "dbManager.saveDB(db); // non-blocking or concurrently handled save",
    "await dbManager.saveDB(db); // now blocking to prevent CF Workers from killing it"
)

with open('functions/api/[[path]].ts', 'w') as f:
    f.write(new_content)

