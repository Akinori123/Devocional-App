import sys

with open('src/components/profile/SubscriptionTab.tsx', 'r') as f:
    content = f.read()

# Make the VIP main card even more luxurious with a glassmorphism vibe
content = content.replace(
    'className="bg-gradient-to-br from-rose-950 to-rose-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-rose-800/50"',
    'className="bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-rose-800/50 shadow-rose-900/20"'
)

# Enhance the background decorations
content = content.replace(
    'className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"',
    'className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"'
)
content = content.replace(
    'className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500 opacity-20 rounded-full -ml-12 -mb-12 blur-xl"',
    'className="absolute bottom-0 left-0 w-48 h-48 bg-rose-400 opacity-20 rounded-full -ml-16 -mb-16 blur-2xl"'
)

# Enhance the header area
content = content.replace(
    'className="flex items-center gap-3"',
    'className="flex items-center gap-4"'
)
content = content.replace(
    'className="bg-rose-800/50 p-2.5 rounded-full border border-rose-700/50"',
    'className="bg-gradient-to-br from-rose-400/20 to-rose-600/20 p-3 rounded-2xl border border-rose-400/30 shadow-inner backdrop-blur-md"'
)
content = content.replace(
    'className="text-xl font-bold font-serif text-white"',
    'className="text-2xl font-bold font-serif text-white tracking-wide"'
)
content = content.replace(
    'className="text-rose-200 text-xs"',
    'className="text-rose-200/90 text-sm font-medium tracking-wider uppercase mt-0.5"'
)

# Enhance the Active/Canceled badge
old_badge = "className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${isCanceled ? 'bg-orange-950/50 border-orange-800/50 text-orange-300' : 'bg-emerald-950/50 border-emerald-800/50 text-emerald-300'}`}"
new_badge = "className={`px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-sm ${isCanceled ? 'bg-orange-950/40 border-orange-500/30 text-orange-300' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'}`}"
content = content.replace(old_badge, new_badge)


# Enhance the Subscription Status card
content = content.replace(
    'className="bg-rose-900/40 rounded-2xl p-4 mb-6 border border-rose-800/30 backdrop-blur-sm"',
    'className="bg-rose-900/30 rounded-2xl p-5 mb-8 border border-rose-700/30 backdrop-blur-md shadow-inner"'
)
content = content.replace(
    'className="text-sm text-white font-medium"',
    'className="text-base text-white font-semibold"'
)
content = content.replace(
    'className="text-xs text-rose-200/80 mt-1"',
    'className="text-sm text-rose-200/80 mt-1.5 leading-relaxed"'
)

# Benefits title
content = content.replace(
    'className="text-sm font-bold text-rose-100 uppercase tracking-wider mb-4"',
    'className="text-xs font-bold text-rose-200/60 uppercase tracking-widest mb-5 ml-1"'
)

# Enhance Benefits list
content = content.replace(
    'className="flex gap-4 items-center bg-rose-900/30 p-3.5 rounded-2xl border border-rose-800/20"',
    'className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm"'
)
content = content.replace(
    'className="bg-rose-800/50 p-2 rounded-xl"',
    'className="bg-rose-800/40 p-2.5 rounded-xl border border-rose-700/30 shadow-inner text-rose-300"'
)

# Enhance Cancel Button
content = content.replace(
    'className="w-full bg-rose-950/50 text-rose-300 py-3.5 rounded-xl font-bold shadow-sm hover:bg-rose-900/80 active:scale-95 transition-all flex justify-center items-center gap-2 border border-rose-800/50"',
    'className="w-full bg-rose-950/40 text-rose-300 py-4 rounded-2xl font-bold shadow-sm hover:bg-rose-900/60 hover:text-rose-200 active:scale-95 transition-all flex justify-center items-center gap-2 border border-rose-800/50 backdrop-blur-md mt-4 hover:border-rose-700/50"'
)

with open('src/components/profile/SubscriptionTab.tsx', 'w') as f:
    f.write(content)

