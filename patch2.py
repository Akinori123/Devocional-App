import sys

with open('src/pages/UsersAdminPanel.tsx', 'r') as f:
    content = f.read()

content = content.replace('          ))\n        )}', '          )})\n        )}')

with open('src/pages/UsersAdminPanel.tsx', 'w') as f:
    f.write(content)
