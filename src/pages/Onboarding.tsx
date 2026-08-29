import React, { useState } from 'react';
import { UserPlus, LogIn, Heart, Star, Sprout, Navigation, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';

type Step = 'welcome' | 'name' | 'journey' | 'need' | 'seed' | 'auth';

export function Onboarding() {
  const toast = useToast();
  const { updateProfileState } = useAuth();
  
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [faithJourney, setFaithJourney] = useState('');
  const [needArea, setNeedArea] = useState('');
  
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const nextStep = (next: Step) => setStep(next);

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return;
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, resetEmail.trim());
      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada e o SPAM.");
      setShowResetModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Se estiver tentando criar conta mas ainda não preencheu o nome/pesquisa, direciona para o questionário
    if (!isLogin && !name.trim()) {
      setIsLogin(false);
      setStep('name');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const userProfile = { 
          email: userCred.user.email,
          uid: userCred.user.uid,
          name: name.trim() || 'Irmã(o)', 
          faithJourney: faithJourney || 'Estou começando agora', 
          needArea: needArea || 'Vencer a Ansiedade', 
          subscriptionStatus: 'free',
          isPremium: false,
          subscriptionDate: null,
          streakCount: 0,
          hasSeenTour: false
        };
        
        await setDoc(doc(db, 'users', userCred.user.uid), userProfile);
        updateProfileState(userProfile as any);
        
        await sendEmailVerification(userCred.user);
        toast.success("Conta criada! Verifique sua caixa de entrada para confirmar seu e-mail.");
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-40 h-40 mb-8 relative">
        <img src="/images/logo.png?v=2" alt="Florescer Devocional Logo" className="w-full h-full object-contain" />
      </div>
      <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-gray-100 mb-4">Que bom ter você aqui!</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        Preparamos um espaço de paz, reflexão e crescimento espiritual para o seu dia a dia.
      </p>
      <button 
        onClick={() => nextStep('name')}
        className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-600 active:scale-95 transition-all shadow-md"
      >
        Começar minha jornada
        <ArrowRight className="w-5 h-5" />
      </button>
      
      <button 
        onClick={() => { setIsLogin(true); nextStep('auth'); }}
        className="mt-6 text-sm font-medium text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 transition-colors"
      >
        Já tenho uma conta
      </button>
    </div>
  );

  const renderName = () => (
    <div className="flex flex-col justify-center h-full px-8 animate-in slide-in-from-right">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Como podemos te chamar?</h2>
      <p className="text-gray-500 mb-8">Queremos que sua experiência seja pessoal e acolhedora.</p>
      
      <input 
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome"
        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-4 text-gray-900 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 shadow-sm mb-6"
        autoFocus
      />
      
      <button 
        onClick={() => nextStep('journey')}
        disabled={!name.trim()}
        className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-700 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-8 mb-4"
      >
        Continuar
      </button>

      <button 
        onClick={() => { setIsLogin(true); nextStep('auth'); }}
        className="text-sm font-medium text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 transition-colors text-center w-full"
      >
        Já tenho uma conta
      </button>
    </div>
  );

  const renderJourney = () => {
    const options = [
      { id: 'Estou começando agora', icon: <Sprout className="w-5 h-5 text-emerald-500" /> },
      { id: 'Caminho com Ele há alguns anos', icon: <Navigation className="w-5 h-5 text-yellow-500" /> },
      { id: 'Nasci em lar cristão / Longa caminhada', icon: <Star className="w-5 h-5 text-yellow-500" /> },
    ];

    return (
      <div className="flex flex-col justify-center h-full px-8 animate-in slide-in-from-right">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Como é a sua caminhada com Cristo?</h2>
        <p className="text-gray-500 mb-8">Isso nos ajuda a trazer palavras mais adequadas para o seu momento.</p>
        
        <div className="space-y-3 mb-8">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFaithJourney(opt.id)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                faithJourney === opt.id 
                  ? "border-yellow-500 bg-yellow-50" 
                  : "border-gray-100 bg-white hover:border-gray-200"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm border",
                faithJourney === opt.id ? "border-yellow-100" : "border-gray-100"
              )}>
                {opt.icon}
              </div>
              <span className={cn(
                "font-semibold",
                faithJourney === opt.id ? "text-yellow-900" : "text-gray-700"
              )}>
                {opt.id}
              </span>
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => nextStep('need')}
          disabled={!faithJourney}
          className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-700 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-8 mb-8"
        >
          Continuar
        </button>
      </div>
    );
  };

  const renderNeed = () => {
    const chips = [
      'Vencer a Ansiedade', 
      'Restauração na Família', 
      'Coragem & Decisões', 
      'Paz nas Finanças', 
      'Superar Luto & Dor', 
      'Gratidão & Renovo', 
      'Propósito & Crescimento'
    ];

    return (
      <div className="flex flex-col justify-center h-full px-8 animate-in slide-in-from-right">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Onde você mais precisa de Deus hoje?</h2>
        <p className="text-gray-500 mb-8">Escolha a área em que seu coração mais precisa de refrigério.</p>
        
        <div className="flex flex-wrap gap-3 mb-8">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => setNeedArea(chip)}
              className={cn(
                "px-5 py-3 rounded-full text-sm font-semibold transition-all border-2",
                needArea === chip 
                  ? "bg-yellow-500 text-white border-yellow-500 shadow-md scale-105" 
                  : "bg-white text-gray-700 border-gray-200 hover:border-yellow-200"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
        
        <button 
          onClick={() => { setIsLogin(false); nextStep('seed'); }}
          disabled={!needArea}
          className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-700 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-8 mb-8"
        >
          Concluir Perfil
        </button>
      </div>
    );
  };

  const renderSeed = () => (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center animate-in zoom-in-95 fade-in duration-500">
      <div className="w-32 h-32 mb-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center shadow-inner relative">
        <div className="absolute inset-0 bg-yellow-400/20 dark:bg-yellow-400/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
        <span className="text-6xl relative z-10">🌱</span>
      </div>
      <h2 className="text-3xl font-bold font-serif text-gray-900 dark:text-gray-100 mb-4">A semente foi plantada!</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed text-lg">
        Hoje você está plantando uma semente. Use o app todos os dias para vê-la crescer!
      </p>
      <button 
        onClick={() => { setIsLogin(false); nextStep('auth'); }}
        className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-600 active:scale-95 transition-all shadow-md mt-4"
      >
        Continuar
      </button>
    </div>
  );

  const renderAuth = () => (
    <div className="flex flex-col justify-center h-full px-8 animate-in fade-in">
      <div className="w-28 h-28 mx-auto mb-6 relative">
        <img src="/images/logo.png?v=2" alt="Florescer Devocional Logo" className="w-full h-full object-contain" />
      </div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLogin ? 'Bem-vindo(a) de volta' : 'Crie sua conta'}
        </h2>
        <p className="text-gray-500">
          {isLogin 
            ? 'Acesse para continuar sua jornada espiritual.' 
            : 'Guarde seu progresso e personalize sua experiência.'}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">E-mail</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 shadow-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Senha</label>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 shadow-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {isLogin && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowResetModal(true);
                }}
                className="text-xs font-semibold text-yellow-500 hover:text-yellow-800 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-700 active:scale-95 transition-all shadow-md disabled:opacity-50 mt-4"
        >
          {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
        </button>
      </form>

      <div className="text-center">
        <button 
          type="button"
          onClick={() => {
            setError('');
            if (isLogin) {
              // Quando o usuário está no Login e clica em 'Crie uma agora',
              // redirecionamos para o início das perguntas do onboarding
              setIsLogin(false);
              setStep('name');
            } else {
              setIsLogin(true);
            }
          }}
          className="text-sm font-medium text-gray-500 hover:text-yellow-500 transition-colors"
        >
          {isLogin 
            ? 'Ainda não tem conta? Crie uma agora.' 
            : 'Já possui uma conta? Entre aqui.'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gray-50 overflow-hidden flex flex-col relative">
      {step === 'welcome' && renderWelcome()}
      {step === 'name' && renderName()}
      {step === 'journey' && renderJourney()}
      {step === 'need' && renderNeed()}
      {step === 'seed' && renderSeed()}
      {step === 'auth' && renderAuth()}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Recuperar Senha</h2>
            <p className="text-sm text-gray-500 mb-6">
              Digite seu e-mail abaixo e enviaremos um link para você redefinir sua senha.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Seu E-mail</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="exemplo@email.com"
                  autoFocus
                />
              </div>
              
              <div className="space-y-3 mt-6">
                <button
                  onClick={handleResetPassword}
                  disabled={loading || !resetEmail.trim()}
                  className="w-full bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center"
                >
                  {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </button>
                <button
                  onClick={() => setShowResetModal(false)}
                  disabled={loading}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
