import sys

with open('src/components/profile/SubscriptionTab.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'className="inline-flex items-center gap-1.5 bg-rose-900/80 text-rose-200 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4 border border-rose-800/50"',
    'className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-200 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 border border-rose-400/30 shadow-inner backdrop-blur-md"'
)

content = content.replace(
    'className="font-bold text-white"',
    'className="font-bold text-white text-base"'
)

content = content.replace(
    'className="text-xs text-rose-200/70"',
    'className="text-sm text-rose-200/80 mt-1"'
)

content = content.replace(
    'className="mb-6 text-center bg-rose-950/40 rounded-2xl p-4 border border-rose-800/50 backdrop-blur-sm"',
    'className="mb-8 text-center bg-black/20 rounded-3xl p-6 border border-white/10 backdrop-blur-md shadow-inner"'
)

content = content.replace(
    'className="text-3xl font-black text-white mb-1"',
    'className="text-4xl font-black text-white mb-1 tracking-tight"'
)

content = content.replace(
    'className="text-xs text-rose-200/80"',
    'className="text-sm text-rose-200/60 uppercase tracking-widest font-medium mt-2"'
)

with open('src/components/profile/SubscriptionTab.tsx', 'w') as f:
    f.write(content)

