import re

with open('src/components/admin/ReportCenter.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove initial state for prepAvatar
content = re.sub(r"const\s+\[prepAvatar,\s*setPrepAvatar\]\s*=\s*useState\([^)]*\);\n?", "", content)

# Remove the avatar setting from some list (if any)
# Remove the OFFICER PASSPORT blocks
content = re.sub(r'\{\/\*\s*PASSPORT AVATAR\s*\*\/\}.*?<div className="relative">.*?</div>\s*</div>', '', content, flags=re.DOTALL)

# Remove the avatar display next to signature input
avatar_input_block = r'<div className="h-10 w-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">.*?</div>'
content = re.sub(avatar_input_block, '', content, flags=re.DOTALL)

# Remove the large avatar in the actual rendered officer profile block
large_avatar_block = r'<div className="h-20 w-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-slate-200">.*?</div>'
content = re.sub(large_avatar_block, '', content, flags=re.DOTALL)

# Update default names to be generic
content = content.replace("useState('Executive Director MMR')", "useState('')")
content = content.replace("useState('Executive Director & Operations')", "useState('Operations Manager')")
content = content.replace("useState('MMR')", "useState('')")

content = content.replace("useState('Dr. Ruqayya Muhammad')", "useState('')")
content = content.replace("useState('Managing Director & CEO')", "useState('Chief Executive Officer')")
content = content.replace("useState('Dr. Ruqayya M.')", "useState('')")

content = content.replace('preparedByName: "Executive Director MMR"', 'preparedByName: "Operations Manager"')
content = content.replace('preparedByPosition: "Executive Director & Operations"', 'preparedByPosition: "Operations Manager"')
content = content.replace('preparedBySignature: "MMR"', 'preparedBySignature: "Signed"')

content = content.replace('approvedByName: "Dr. Ruqayya Muhammad"', 'approvedByName: ""')

with open('src/components/admin/ReportCenter.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
