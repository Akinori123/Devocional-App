import sys

with open('src/pages/UsersAdminPanel.tsx', 'r') as f:
    content = f.read()

# For the active buttons
content = content.replace('onClick={() => togglePremium(u)}', 'onClick={() => togglePremium(u)}\n                      disabled={isTargetAdmin}')
content = content.replace('onClick={() => resetImageLimit(u)}', 'onClick={() => resetImageLimit(u)}\n                      disabled={isTargetAdmin}')
content = content.replace('onClick={() => setUserToSuspend(u)}', 'onClick={() => setUserToSuspend(u)}\n                      disabled={isTargetAdmin}')
content = content.replace('onClick={() => setUserToSoftDelete(u)}', 'onClick={() => setUserToSoftDelete(u)}\n                      disabled={isTargetAdmin}')

# For the inactive buttons
content = content.replace('onClick={() => restoreUser(u)}', 'onClick={() => restoreUser(u)}\n                      disabled={isTargetAdmin}')
content = content.replace('onClick={() => setUserToHardDelete(u)}', 'onClick={() => setUserToHardDelete(u)}\n                      disabled={isTargetAdmin}')

# Add disabled styling
content = content.replace('transition-colors",', 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed",')
content = content.replace('transition-colors"', 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed"')

with open('src/pages/UsersAdminPanel.tsx', 'w') as f:
    f.write(content)
