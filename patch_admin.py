import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

# Tabs Container
content = content.replace(
    'className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-6 shadow-inner"',
    'className="flex bg-gray-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-8 border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-sm"'
)

content = content.replace(
    '''? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300\'''',
    '''? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300\''''
)

# Replace active state classes
content = content.replace(
    "? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'",
    "? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10'"
)

# Panels / Cards
content = content.replace(
    'className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 mb-6 border border-gray-100 dark:border-slate-800"',
    'className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-sm p-8 mb-8 border border-gray-100 dark:border-slate-700/50 backdrop-blur-sm"'
)

# Additional Panels
content = content.replace(
    'className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-800"',
    'className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-slate-700/50 backdrop-blur-sm"'
)

content = content.replace(
    'className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl"',
    'className="bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-gray-100 dark:border-slate-700/50"'
)

content = content.replace(
    'className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100 dark:border-slate-800 gap-4"',
    'className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 border-b border-gray-100 dark:border-slate-700/50 gap-4 bg-gray-50/50 dark:bg-slate-800/30"'
)

# Buttons
content = content.replace(
    'className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"',
    'className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"'
)

content = content.replace(
    'className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"',
    'className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"'
)

content = content.replace(
    'className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"',
    'className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"'
)

# List items
content = content.replace(
    'className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"',
    'className="p-5 bg-white dark:bg-slate-900/50 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-slate-700 hover:border-yellow-200 dark:hover:border-slate-500 transition-all shadow-sm hover:shadow-md"'
)

# Module headers
content = content.replace(
    'className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700"',
    'className="flex justify-between items-center bg-white dark:bg-slate-800/80 p-5 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md"'
)

with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)

