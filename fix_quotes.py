import re

with open('functions/api/[[path]].ts', 'r') as f:
    content = f.read()

content = content.replace(r'\"Failed to dispatch push notification in saveDB:\"', '"Failed to dispatch push notification in saveDB:"')

with open('functions/api/[[path]].ts', 'w') as f:
    f.write(content)

