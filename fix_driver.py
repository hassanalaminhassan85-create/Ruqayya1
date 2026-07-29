import re

with open("driver_errors.txt") as f:
    errors = f.read().splitlines()

line_numbers = []
for err in errors:
    m = re.search(r'DriverDashboard\.tsx\((\d+),', err)
    if m:
        line_numbers.append(int(m.group(1)))

line_numbers = sorted(list(set(line_numbers)), reverse=True)

with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

for l in line_numbers:
    # Insert at l-1 (which is index l-2 or l-1?)
    # If error is at line 996, we want to insert before 996.
    # index 995 is line 996. So we insert at index 995.
    lines.insert(l - 1, "      )}")

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
