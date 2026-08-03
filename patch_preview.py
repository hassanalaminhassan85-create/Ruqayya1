import re

file_path = 'server.ts'
with open(file_path, 'r') as f:
    content = f.read()

secure_preview = """
    // Allow previewing if a token is provided and corresponds to an active session
    let authorized = false;
    if (token) {
      const session = db.sessions.find(s => s.token === token && s.status === 'active');
      if (session) authorized = true;
    }
"""

content = re.sub(
    r"// Allow previewing if a token is provided OR if there is any active session in the database.*?if \(hasActiveSession\) authorized = true;\s*}",
    secure_preview.strip(),
    content,
    flags=re.DOTALL
)

with open(file_path, 'w') as f:
    f.write(content)
print("Preview patched!")
