import os
import re

directories = ['src', 'server.ts', 'functions']

pattern = re.compile(r'\.reduce\(\s*\(\s*([a-zA-Z0-9_]+)\s*(?:[:,]\s*[a-zA-Z0-9_]+\s*)?,\s*([a-zA-Z0-9_]+)\s*(?::\s*any\s*)?\)\s*=>\s*\1\s*\+\s*\(\s*\2\.([a-zA-Z0-9_]+)\s*\|\|\s*0\s*\)\s*,\s*0\s*\)')

def replace_match(match):
    acc = match.group(1)
    item = match.group(2)
    prop = match.group(3)
    return f'.reduce(({acc}, {item}: any) => {acc} + (parseFloat({item}.{prop}) || 0), 0)'

for root_dir in directories:
    if os.path.isfile(root_dir):
        files = [root_dir]
    else:
        files = []
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    files.append(os.path.join(dirpath, filename))
                    
    for filepath in files:
        with open(filepath, 'r') as f:
            content = f.read()
            
        new_content = pattern.sub(replace_match, content)
        
        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Patched {filepath}")

