with open("src/features/ShareholderDashboard.tsx") as f:
    lines = f.read().splitlines()

line_numbers = [816, 934, 938, 985, 991, 998, 1101]

for l in sorted(line_numbers, reverse=True):
    # Just print the lines around l to see where ')}' belongs
    start = max(0, l - 5)
    end = min(len(lines), l + 5)
    print(f"--- Line {l} ---")
    for i in range(start, end):
        print(f"{i+1}: {lines[i]}")
