import sys

def move_function(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    start_idx = -1
    for i, line in enumerate(lines):
        if "function getMaiduguriSimulatedDataCF" in line:
            start_idx = i
            break
            
    if start_idx == -1:
        print("Function not found")
        return
        
    end_idx = -1
    brace_count = 0
    for i in range(start_idx, len(lines)):
        line = lines[i]
        brace_count += line.count('{')
        brace_count -= line.count('}')
        
        if brace_count == 0 and '{' in ''.join(lines[start_idx:i+1]):
            end_idx = i
            break
            
    if end_idx == -1:
        print("End not found")
        return
        
    func_lines = lines[start_idx:end_idx+1]
    
    # Remove from original location
    new_lines = lines[:start_idx] + lines[end_idx+1:]
    
    # Insert at top, just after imports
    insert_idx = 0
    for i, line in enumerate(new_lines):
        if "export const onRequest" in line or "declare global" in line or "interface Env" in line:
            insert_idx = i
            break
            
    final_lines = new_lines[:insert_idx] + func_lines + ["\n"] + new_lines[insert_idx:]
    
    with open(filepath, 'w') as f:
        f.writelines(final_lines)
        
    print(f"Moved function from {start_idx} to {insert_idx}")

move_function('functions/api/[[path]].ts')
