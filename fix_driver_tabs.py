with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

tabs = ["PAYMENT HISTORY TAB", "VEHICLE PAGE TAB", "COMPANY DOCUMENTS TAB", "PROFILE TAB"]

for tab in tabs:
    idx = -1
    for i, line in enumerate(lines):
        if tab in line:
            idx = i
            break
    if idx != -1:
        lines.insert(idx, "          )}")

# For the last tab (profile), insert before `</motion.div>`
idx = -1
for i in range(len(lines)-1, -1, -1):
    if "</motion.div>" in lines[i]:
        idx = i
        break

if idx != -1:
    lines.insert(idx, "          )}")

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
