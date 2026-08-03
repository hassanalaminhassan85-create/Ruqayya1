import re

with open('src/components/admin/ReportCenter.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('const renderReportDocument = () => (')
if start_idx != -1:
    end_idx = content.find('  const downloadFullPdf = () => {')
    if end_idx != -1:
        print(content[start_idx:end_idx])
