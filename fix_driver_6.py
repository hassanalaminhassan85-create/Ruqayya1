with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

def print_context(l, num=10):
    start = max(0, l - num)
    end = min(len(lines), l + num)
    print(f"--- Around {l} ---")
    for i in range(start, end):
        print(f"{i+1}: {lines[i]}")

errs = [1683, 1787, 2074, 2116, 2551]
for e in errs:
    print_context(e, 8)
