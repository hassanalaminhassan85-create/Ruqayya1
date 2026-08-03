import os
import re

SVG_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e2e8f0'/><text x='50' y='55' font-family='sans-serif' font-size='40' fill='%2394a3b8' text-anchor='middle' dominant-baseline='middle'>?</text></svg>"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all img tags, and if they don't have onError, add it.
    # We only want to add this to avatar/passport images, but honestly it's safe for any img 
    # except maybe the main logo.
    # The logo uses src="/logo.jpg", which is reliable. 
    # Let's add onError to ALL img tags just in case, but avoid double adding.
    
    def replace_img(match):
        tag = match.group(0)
        if 'onError' in tag:
            return tag
        # Insert onError right after <img
        return tag.replace('<img', f'''<img onError={{(e) => {{ e.currentTarget.src = "{SVG_PLACEHOLDER}"; }}}}''')

    # Match <img ... >
    # Using regex to find img tags
    content = re.sub(r'<img\s+[^>]+>', replace_img, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

print("Done processing files round 4")
