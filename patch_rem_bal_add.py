import os
import re

directories = ['src', 'server.ts', 'functions']

pattern = re.compile(r'([a-zA-Z0-9_]+)\.remaining_vehicle_balance\s*=\s*\1\.remaining_vehicle_balance\s*\+\s*([a-zA-Z0-9_\.]+)\s*;')

def replace_match(match):
    drv = match.group(1)
    amt = match.group(2)
    return f'{drv}.remaining_vehicle_balance = parseFloat({drv}.remaining_vehicle_balance) + parseFloat({amt});'

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

