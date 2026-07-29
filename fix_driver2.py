with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

# the lines shown in errors:
# 997, 1025, 1209, 1297, 1538, 1555, 1562, 1578, 1694, 1699, 1781, 1786, 1829, 1831, 1859, 2011, 2051, 2080, 2117, 2123, 2127, 2250, 2255, 2320, 2350, 2450, 2455, 2562

# Let's just find `            </div>` that might need `              )}`
# Wait! Instead of guessing, I can see where `{condition && (` is not closed.
# There are exactly 28 missing closing brackets.
# Let's print out the exact lines.
err_lines = [997, 1025, 1209, 1297, 1538, 1555, 1562, 1578, 1694, 1699, 1781, 1786, 1829, 1831, 1859, 2011, 2051, 2080, 2117, 2123, 2127, 2250, 2255, 2320, 2350, 2450, 2455, 2562]
for l in err_lines:
    start = max(0, l - 4)
    end = min(len(lines), l + 1)
    print(f"--- {l} ---")
    for i in range(start, end):
        print(f"{i+1}: {lines[i]}")
