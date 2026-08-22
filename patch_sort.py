import sys

with open('src/components/journey/JourneyList.tsx', 'r') as f:
    content = f.read()

old_sort = """.sort((a, b) => a.id.localeCompare(b.id));"""
new_sort = """.sort((a, b) => {
      // Tenta ordenar por createdAt primeiro
      if (a.createdAt && b.createdAt) {
         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
         if (timeA !== timeB) return timeA - timeB;
      }
      
      // Fallback para os mocks (d1, d2, d10, etc.)
      const numA = parseInt(a.id.replace(/\\D/g, ''));
      const numB = parseInt(b.id.replace(/\\D/g, ''));
      
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
         return numA - numB;
      }
      
      return a.id.localeCompare(b.id);
    });"""

content = content.replace(old_sort, new_sort)

with open('src/components/journey/JourneyList.tsx', 'w') as f:
    f.write(content)

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()
content = content.replace(old_sort, new_sort)
with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)
    
