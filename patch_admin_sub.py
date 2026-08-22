import sys

with open('src/components/profile/SubscriptionTab.tsx', 'r') as f:
    content = f.read()

old_admin = """  if (isAdmin) {
    return (
      <div className="p-5">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center">
          <div className="flex flex-col items-center gap-3 mb-4 mt-2">
            <div className="bg-gradient-to-br from-rose-600 to-rose-900 p-4 rounded-full shadow-md">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold font-serif text-gray-900 dark:text-white mt-2">Acesso Total (Admin)</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
            Você possui Acesso VIP de Administrador.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Todos os recursos do aplicativo estão liberados para a sua conta.
          </p>
        </div>
      </div>
    );
  }"""

new_admin = """  if (isAdmin) {
    return (
      <div className="p-5">
        <div className="bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-purple-800/50 shadow-purple-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400 opacity-20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
          
          <div className="relative z-10 text-center">
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-purple-400/20 to-purple-600/20 p-5 rounded-3xl border border-purple-400/30 shadow-inner backdrop-blur-md mb-2">
                <ShieldCheck className="w-10 h-10 text-purple-200" />
              </div>
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-purple-400/30 shadow-inner backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nível Deus / Administrador</span>
              </div>
              <h3 className="text-3xl font-bold font-serif text-white tracking-wide mt-2">Acesso Total</h3>
            </div>
            
            <div className="bg-purple-900/30 rounded-2xl p-6 mb-6 border border-purple-700/30 backdrop-blur-md shadow-inner text-left">
              <div className="flex items-start gap-4">
                <Crown className="w-6 h-6 text-purple-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-base text-white font-semibold">Conta Administrativa Blindada</p>
                  <p className="text-sm text-purple-200/80 mt-1.5 leading-relaxed">
                    Você possui todos os benefícios Premium VIP liberados permanentemente. Imagens de IA, Áudios, Vídeos e gerenciamento de plataforma.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-2 text-left">
              {vipBenefits.map((benefit, i) => (
                <div key={i} className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <div className="bg-purple-800/40 p-2.5 rounded-xl border border-purple-700/30 shadow-inner text-purple-300">
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{benefit.title}</p>
                    <p className="text-xs text-purple-200/80 mt-0.5 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }"""

content = content.replace(old_admin, new_admin)

with open('src/components/profile/SubscriptionTab.tsx', 'w') as f:
    f.write(content)
