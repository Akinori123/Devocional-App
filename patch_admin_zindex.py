import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className="fixed inset-0 bg-black/60 z-50 flex justify-center',
    'className="fixed inset-0 bg-black/60 z-[60] flex justify-center'
)

content = content.replace(
    'className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center',
    'className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center'
)

with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)

