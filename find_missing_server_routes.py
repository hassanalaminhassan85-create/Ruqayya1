import re

server_ts = open('server.ts', 'r').read()
path_ts = open('functions/api/[[path]].ts', 'r').read()

server_routes = set(re.findall(r"app\.(get|post|put|delete)\('([^']+)'", server_ts))

# Extract all exact paths and startsWith paths from path.ts
path_exact = set(re.findall(r"path === '([^']+)'", path_ts))
path_starts = set(re.findall(r"path\.startsWith\('([^']+)'", path_ts))
path_ctrl = set(re.findall(r"ctrl === '([^']+)'", path_ts))
path_ctrl_starts = set(re.findall(r"ctrl\.startsWith\('([^']+)'\)", path_ts))

# List everything that path.ts seems to support
print("Routes in path.ts that might be missing in server.ts:")
for route in sorted(path_exact):
    # Check if this exact route is in server_routes
    found = False
    for method, sr in server_routes:
        if sr == route:
            found = True
            break
    if not found:
        print(f"MISSING EXACT: {route}")

