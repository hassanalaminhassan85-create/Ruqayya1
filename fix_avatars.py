import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Remove saving Unsplash URLs (e.g. `|| 'https://images.unsplash.com/...'`)
    # This regex catches: || 'https://images.unsplash.com/...'
    content = re.sub(r"\|\|\s*['\"]https://images\.unsplash\.com/[^'\"]+['\"]", "|| ''", content)
    
    # 2. Fix the logo URLs
    content = content.replace("/src/assets/images/ruqayya_logo_1783430629037.jpg", "/logo.jpg")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

print("Done processing files")
