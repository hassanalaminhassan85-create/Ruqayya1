with open("src/features/DriverDashboard.tsx") as f:
    lines = f.read().splitlines()

replacements = {
    996: "      )}",
    1023: "              )}",
    1207: "                )}",
    1295: "                  )}",
    1536: "                          <>",
    1554: "                          </>",
    1561: "                          <>",
    1576: "                          </>",
    1692: "                )}",
    1697: "          )}",
    1779: "                                )}",
    1784: "                        )}",
    1827: "                        )}",
    1830: "                          <>",
    1857: "                                )}",
    2010: "                          <>",
    2049: "                                <>",
    2078: "                                </>",
    2115: "                              )}",
    2121: "                          </>", # Wait
    2125: "                )}",
    2248: "                )}",
    2252: "          )}",
    2318: "                  )}",
    2347: "          )}",
    2448: "                  )}",
    2452: "          )}",
    2560: "          )}"
}

for i in sorted(replacements.keys(), reverse=True):
    # lines[i] is line i+1.
    lines[i] = replacements[i]

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write("\n".join(lines))
