import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 3. Clean up specific FinancialCommandCenter preset block
    content = re.sub(r'<div className="flex gap-2">\s*<button[^>]+Preset 1.*?Preset 3.*?</button>\s*</div>', '', content, flags=re.DOTALL)
    
    # 4. In ReportCenter, there are arrays of unsplash links:
    content = re.sub(r'"https://images.unsplash.com/[^"]+"', '""', content)
    content = re.sub(r"'https://images.unsplash.com/[^']+'", "''", content)
    
    # Also fix the placeholder texts
    content = content.replace('placeholder="https://images.unsplash.com/... or paste image URL"', 'placeholder="Paste image URL"')
    content = content.replace('placeholder="https://images.unsplash.com/... or image URL"', 'placeholder="Paste image URL"')

    # Also there is a check in PeopleManagement.tsx line 2394:
    # selectedDocumentPreview.file_url.includes('unsplash.com') 
    # we can remove the unsplash part of the condition.
    content = content.replace(" || selectedDocumentPreview.file_url.includes('unsplash.com')", "")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

print("Done processing files round 2")
