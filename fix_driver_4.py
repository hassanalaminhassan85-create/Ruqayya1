with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

# Find OVERVIEW TAB and PAYMENTS TAB
overview_idx = -1
payments_idx = -1

for i, line in enumerate(lines):
    if "OVERVIEW TAB" in line:
        overview_idx = i
    if "INSTALLMENTS & BILLING TAB" in line:
        payments_idx = i

if overview_idx != -1 and payments_idx != -1:
    lines.insert(payments_idx, "          )}")

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
