import re

with open("src/features/AdminDashboard.tsx") as f:
    lines = f.read().splitlines()

# The original problem was: "When clicked they show blank page"
# It might be because we have conditional renders `{activeTab === 'dashboard' && (` but the closing is missing.
# Wait, tsc showed NO syntax errors for AdminDashboard.tsx !!
# That means AdminDashboard.tsx compiled successfully. 
