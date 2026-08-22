import sys

with open('src/components/journey/JourneyList.tsx', 'r') as f:
    content = f.read()

old_logic = """                   let currentModule = readCount === 0 ? 1 : Math.floor((readCount - 1) / DAYS_PER_MODULE) + 1;
                   if (currentModule > totalModules) {
                     currentModule = totalModules;
                   }
                   
                   let totalInCurrentModule = DAYS_PER_MODULE;
                   if (currentModule === totalModules) {
                     totalInCurrentModule = (total % DAYS_PER_MODULE === 0 && total > 0) ? DAYS_PER_MODULE : total % DAYS_PER_MODULE;
                   }
                   
                   let moduleReadCount = readCount - ((currentModule - 1) * DAYS_PER_MODULE);
                   if (moduleReadCount > totalInCurrentModule) {
                     moduleReadCount = totalInCurrentModule;
                   }"""

new_logic = """                   let currentModule = 1;
                   if (total === 0) {
                     currentModule = 1;
                   } else if (readCount === total) {
                     currentModule = totalModules;
                   } else {
                     currentModule = Math.floor(readCount / DAYS_PER_MODULE) + 1;
                   }
                   
                   let totalInCurrentModule = DAYS_PER_MODULE;
                   if (total === 0) {
                     totalInCurrentModule = 0;
                   } else if (currentModule === totalModules) {
                     totalInCurrentModule = (total % DAYS_PER_MODULE === 0) ? DAYS_PER_MODULE : total % DAYS_PER_MODULE;
                   }
                   
                   let moduleReadCount = total === 0 ? 0 : readCount - ((currentModule - 1) * DAYS_PER_MODULE);"""

content = content.replace(old_logic, new_logic)

with open('src/components/journey/JourneyList.tsx', 'w') as f:
    f.write(content)

