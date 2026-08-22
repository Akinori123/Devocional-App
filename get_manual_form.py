import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'showManualModal && (' in line:
        start = i
        break

for i in range(start, len(lines)):
    if '          </div>' in lines[i] and '        </div>' in lines[i+1] and '      )}' in lines[i+2]:
        end = i + 3
        break

print("".join(lines[start:end]))
