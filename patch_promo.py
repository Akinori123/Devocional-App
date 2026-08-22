import sys

with open('src/components/profile/SubscriptionTab.tsx', 'r') as f:
    content = f.read()

# Make the Free Tier Promotion look as premium as the VIP card
content = content.replace(
    'className="w-full bg-white text-rose-950 py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-50 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"',
    'className="w-full bg-white text-rose-950 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"'
)

content = content.replace(
    'className="text-2xl font-bold font-serif mb-2"',
    'className="text-3xl font-bold font-serif mb-3 tracking-wide"'
)

content = content.replace(
    'className="flex items-start gap-3 text-sm"',
    'className="flex items-start gap-4 text-sm bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm"'
)

content = content.replace(
    'className="w-5 h-5 text-rose-300 shrink-0 mt-0.5"',
    'className="w-5 h-5 text-rose-300 shrink-0 mt-0.5"'
)

with open('src/components/profile/SubscriptionTab.tsx', 'w') as f:
    f.write(content)

