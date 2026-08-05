import os
import re

directories = ['src', 'server.ts', 'functions']

def replace_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    new_content = content
    new_content = re.sub(r'const shareRatio = \(sh\.investment_amount \|\| 0\) / totalInvestment;', r'const shareRatio = (parseFloat(sh.investment_amount) || 0) / totalInvestment;', new_content)
    new_content = re.sub(r'const shPercentage = sh\.investment_amount / totalInvestment;', r'const shPercentage = (parseFloat(sh.investment_amount) || 0) / totalInvestment;', new_content)
    new_content = re.sub(r'sh\.earnings_to_date = \(sh\.earnings_to_date \|\| 0\) \+ shEarnings;', r'sh.earnings_to_date = (parseFloat(sh.earnings_to_date) || 0) + shEarnings;', new_content)
    new_content = re.sub(r'\(\(sh\.investment_amount / totalInvestmentsSum\) \* 100\)', r'(((parseFloat(sh.investment_amount) || 0) / totalInvestmentsSum) * 100)', new_content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Patched {filepath}")

for root_dir in directories:
    if os.path.isfile(root_dir):
        replace_file(root_dir)
    else:
        for dirpath, _, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    replace_file(os.path.join(dirpath, filename))

