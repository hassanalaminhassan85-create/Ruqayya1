with open("src/features/ShareholderDashboard.tsx") as f:
    lines = f.read().splitlines()

# 1101 -> 1100
lines[1099] = "          )}"
# 998 -> 997
lines[996] = "          )}"
# 991 -> 990
lines[989] = "                        )}"
# 985 -> 984
lines[983] = "                                )}"
# 938 -> 937
lines[936] = "          )}"
# 934 -> 933
lines[932] = "                )}"
# 816 -> 815
lines[814] = "                    )}"

with open("src/features/ShareholderDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
