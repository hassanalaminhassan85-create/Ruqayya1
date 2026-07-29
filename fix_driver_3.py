with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

# Find the OVERVIEW TAB comment
for i, line in enumerate(lines):
    if "OVERVIEW TAB" in line:
        # We need to insert `{activeTab === 'overview' && (` after it!
        lines.insert(i + 1, "          {activeTab === 'overview' && (")
        break

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
