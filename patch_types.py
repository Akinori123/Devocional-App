import sys

with open('src/data/devotionals.ts', 'r') as f:
    content = f.read()

content = content.replace(
    '  content: string;\n}',
    '  content: string;\n  createdAt?: any;\n}'
)

with open('src/data/devotionals.ts', 'w') as f:
    f.write(content)
