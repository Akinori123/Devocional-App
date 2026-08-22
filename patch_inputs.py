import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

# Refine standard inputs
content = content.replace(
    'className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder:text-gray-400"',
    'className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"'
)

# Textareas
content = content.replace(
    'className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none"',
    'className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none shadow-sm"'
)

# Select fields
content = content.replace(
    'className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white"',
    'className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white shadow-sm"'
)

# Search inputs
content = content.replace(
    'className="w-full px-4 py-3 pl-10 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"',
    'className="w-full px-4 py-3.5 pl-11 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"'
)

# Specific Save Buttons to look more premium
content = content.replace(
    'className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"',
    'className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 transition-all disabled:opacity-50"'
)

content = content.replace(
    'className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-gray-200 dark:border-slate-700 shadow-sm"',
    'className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"'
)

with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)

