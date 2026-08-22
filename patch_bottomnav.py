import sys

with open('src/components/BottomNav.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'z-50 transition-all duration-300 ease-in-out"',
    'z-40 transition-all duration-300 ease-in-out"'
)

with open('src/components/BottomNav.tsx', 'w') as f:
    f.write(content)
