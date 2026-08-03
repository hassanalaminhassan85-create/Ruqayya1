import re

server_ts = open('server.ts', 'r').read()
path_ts = open('functions/api/[[path]].ts', 'r').read()

server_routes = set(re.findall(r"app\.(get|post|put|delete)\('([^']+)'", server_ts))
print(f"Total server routes: {len(server_routes)}")

# Find routes in path.ts
# they look like: if (path === '/api/something')
path_exact = set(re.findall(r"path === '([^']+)'", path_ts))
path_starts = set(re.findall(r"path\.startsWith\('([^']+)'", path_ts))
path_ctrl = set(re.findall(r"ctrl === '([^']+)'", path_ts))

# try to map path.ts to express routes
path_routes = set()
for path in path_exact:
    path_routes.add(path)

for path in path_starts:
    path_routes.add(path)

for ctrl in path_ctrl:
    path_routes.add('/api/director/' + ctrl)

print("\nMissing routes:")
for method, route in sorted(server_routes):
    # Try to see if this route is handled by exact match, startsWith, or ctrl
    handled = False
    
    # check exact
    if route in path_exact:
        handled = True
    
    # check startsWith
    for s in path_starts:
        if route.startswith(s):
            handled = True
            
    # check ctrl
    if route.startswith('/api/director/'):
        ctrl = route.replace('/api/director/', '')
        if ctrl in path_ctrl or ctrl.split('/')[0] in path_ctrl:
            handled = True
            
    if not handled:
        print(f"  {method.upper()} {route}")

