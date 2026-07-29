import re

with open("src/features/DriverDashboard.tsx") as f:
    content = f.read()

# Fix the end of the file.
content = re.sub(r'          \)}\s*</motion\.div>\s*</AnimatePresence>\s*</div>\s*\);\s*};\s*// Simple helper component', 
    '          )}\n        </motion.div>\n      </AnimatePresence>\n    </div>\n  );\n};\n\n// Simple helper component', 
    content, flags=re.MULTILINE|re.DOTALL)

with open("src/features/DriverDashboard.tsx", "w") as f:
    f.write(content)
