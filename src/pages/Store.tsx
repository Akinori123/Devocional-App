import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  ShoppingBag, 
  ChevronRight, 
  X, 
  Check, 
  Loader2, 
  Truck, 
  ShieldCheck, 
  CreditCard, 
  Flame, 
  ChevronLeft,
  Package,
  MapPin,
  ExternalLink,
  Phone,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';
import { 
  StoreCategory, 
  StoreProduct, 
  StoreDeliveryAddress, 
  TabType 
} from '../types';
import { 
  getStoreCategories, 
  getStoreProducts, 
  createStoreCheckoutPreference 
} from '../services/storeService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import { useDragScroll } from '../hooks/useDragScroll';

interface StoreProps {
  onChangeTab?: (tab: TabType, subTab?: any) => void;
}

export function Store({ onChangeTab }: StoreProps) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { dragProps: catDragProps, hasDragged: catHasDragged } = useDragScroll<HTMLDivElement>();

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Produto Selecionado para Detalhes
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Modal de Checkout / Endereço de Entrega
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.name || (profile as any)?.displayName || user?.displayName || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const isSubmittingCheckoutRef = useRef(false);

  // Estados de Validação e Erros dos Campos
  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [cepError, setCepError] = useState('');
  const [cepWarning, setCepWarning] = useState('');
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'valid' | 'fallback' | 'invalid' | 'incomplete'>('idle');
  const [isAddressLocked, setIsAddressLocked] = useState(false);
  const [streetError, setStreetError] = useState('');
  const [numberError, setNumberError] = useState('');
  const [neighborhoodError, setNeighborhoodError] = useState('');
  const [cityError, setCityError] = useState('');
  const [stateError, setStateError] = useState('');
  const [formAttempted, setFormAttempted] = useState(false);

  useEffect(() => {
    loadStoreData();
  }, []);

  // Preencher nome e email caso atualizem no perfil
  useEffect(() => {
    if (!fullName && (profile?.name || (profile as any)?.displayName || user?.displayName)) {
      setFullName(profile?.name || (profile as any)?.displayName || user?.displayName || '');
    }
    if (!email && (profile?.email || user?.email)) {
      setEmail(profile?.email || user?.email || '');
    }
  }, [profile, user]);

  const loadStoreData = async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        getStoreCategories(),
        getStoreProducts(false) // apenas produtos ativos na vitrine
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('Erro ao carregar dados da loja:', err);
      toast.error('Não foi possível carregar a vitrine da loja.');
    } finally {
      setLoading(false);
    }
  };

  // 1. MÁSCARA E VALIDAÇÃO DE TELEFONE / WHATSAPP: (00) 00000-0000 (11 dígitos)
  const formatPhone = (val: string): string => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length === 0) return '';
    if (raw.length <= 2) return `(${raw}`;
    if (raw.length <= 7) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setPhone(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length > 0 && digits.length !== 11) {
      setPhoneError('Telefone inválido. Verifique os números (11 dígitos com DDD).');
    } else {
      setPhoneError('');
    }
  };

  // 2. MÁSCARA E VALIDAÇÃO DE CEP VIA VIACEP: 00000-000 (8 dígitos)
  const formatCep = (val: string): string => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    if (raw.length <= 5) return raw;
    return `${raw.slice(0, 5)}-${raw.slice(5, 8)}`;
  };

  const handleCepChange = async (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 8);
    const formatted = formatCep(raw);
    setCep(formatted);
    setCepWarning('');

    // Se o usuário apagou ou ainda não digitou 8 dígitos completos
    if (raw.length < 8) {
      setCepStatus(raw.length === 0 ? 'idle' : 'incomplete');
      setCepError(raw.length > 0 ? 'Digite o CEP completo com 8 dígitos.' : '');
      setIsAddressLocked(false);
      return;
    }

    // 8 dígitos: acionar busca automática ViaCEP
    setLoadingCep(true);
    setCepStatus('loading');
    setCepError('');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (!res.ok) throw new Error('Falha de conexão com ViaCEP');
      const data = await res.json();

      if (data.erro || (!data.logradouro && !data.localidade)) {
        // Fallback Manual: CEP não localizado automaticamente na base do ViaCEP
        // NÃO bloqueia o botão de pagamento!
        // Alerta em tom amarelo/laranja e desbloqueia os campos para preenchimento manual
        setCepStatus('fallback');
        setCepError('');
        setCepWarning('CEP não localizado automaticamente. Por favor, preencha seu endereço abaixo.');
        setIsAddressLocked(false);
        toast.info('CEP não localizado automaticamente. Você pode preencher seu endereço manualmente.');
      } else {
        // Sucesso: Preenche os dados e bloqueia os campos automáticos
        setCepStatus('valid');
        setCepError('');
        setCepWarning('');
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
        setIsAddressLocked(true);
        setStreetError('');
        setNeighborhoodError('');
        setCityError('');
        setStateError('');
      }
    } catch (err) {
      console.warn('ViaCEP offline ou indisponível, ativando fallback manual:', err);
      setCepStatus('fallback');
      setCepError('');
      setCepWarning('CEP não localizado automaticamente. Por favor, preencha seu endereço abaixo.');
      setIsAddressLocked(false);
      toast.info('CEP não localizado automaticamente. Você pode preencher seu endereço manualmente.');
    } finally {
      setLoadingCep(false);
    }
  };

  // 3. REGEX PADRÃO DE E-MAIL
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (!value.trim()) {
      setEmailError('Informe seu e-mail.');
    } else if (!emailRegex.test(value.trim())) {
      setEmailError('E-mail inválido');
    } else {
      setEmailError('');
    }
  };

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    if (!value.trim()) {
      setFullNameError('Informe o nome completo do destinatário.');
    } else if (value.trim().length < 3) {
      setFullNameError('Informe o nome e sobrenome completos.');
    } else {
      setFullNameError('');
    }
  };

  // 4. VERIFICAÇÃO SE TODO O FORMULÁRIO ESTÁ 100% VÁLIDO E PREENCHIDO
  const isFormValid = useMemo(() => {
    const rawPhone = phone.replace(/\D/g, '');
    const rawCep = cep.replace(/\D/g, '');

    const validName = fullName.trim().length >= 3;
    const validEmail = emailRegex.test(email.trim());
    const validPhone = rawPhone.length === 11;
    // O CEP é considerado válido se possuir exatamente 8 dígitos (mesmo no modo manual/fallback)
    const validCep = rawCep.length === 8;
    const validStreet = street.trim().length > 0;
    const validNumber = number.trim().length > 0;
    const validNeighborhood = neighborhood.trim().length > 0;
    const validCity = city.trim().length > 0;
    const validState = state.trim().length === 2;

    return (
      validName &&
      validEmail &&
      validPhone &&
      validCep &&
      validStreet &&
      validNumber &&
      validNeighborhood &&
      validCity &&
      validState &&
      !loadingCep
    );
  }, [
    fullName,
    email,
    phone,
    cep,
    street,
    number,
    neighborhood,
    city,
    state,
    loadingCep
  ]);

  const handleOpenProductDetails = (product: StoreProduct) => {
    if (!product.isActive || product.stock <= 0) return;
    setSelectedProduct(product);
    setCurrentImageIndex(0);
  };

  const handleStartCheckout = (product: StoreProduct) => {
    if (!product.isActive || product.stock <= 0) return;
    setSelectedProduct(product);
    setFormAttempted(false);
    // Limpar estados de erro ao abrir novo checkout
    setPhoneError('');
    setCepError('');
    setCepWarning('');
    setIsAddressLocked(false);
    setEmailError('');
    setFullNameError('');
    setStreetError('');
    setNumberError('');
    setNeighborhoodError('');
    setCityError('');
    setStateError('');
    setCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processingCheckout || isSubmittingCheckoutRef.current) {
      return;
    }
    setFormAttempted(true);

    if (!selectedProduct) return;

    // 1. Validação de Nome Completo
    if (!fullName.trim() || fullName.trim().length < 3) {
      setFullNameError('Informe o nome completo do destinatário.');
      toast.error('Informe o nome completo do destinatário.');
      return;
    }

    // 2. Validação de E-mail com Regex
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setEmailError('E-mail inválido');
      toast.error('E-mail inválido. Verifique o endereço digitado.');
      return;
    }

    // 3. Validação de Telefone / WhatsApp (exatamente 11 dígitos)
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length !== 11) {
      setPhoneError('Telefone inválido. Verifique os números.');
      toast.error('Telefone inválido. Verifique os números.');
      return;
    }

    // 4. Validação de CEP (exige 8 dígitos válidos)
    const rawCep = cep.replace(/\D/g, '');
    if (rawCep.length !== 8) {
      setCepError('Informe um CEP válido com 8 dígitos.');
      toast.error('Informe um CEP válido com 8 dígitos.');
      return;
    }

    // 5. Validação de Endereço Completo
    if (!street.trim()) {
      setStreetError('Informe o nome da rua / logradouro.');
      toast.error('Informe o nome da rua / logradouro.');
      return;
    }
    if (!number.trim()) {
      setNumberError('Informe o número.');
      toast.error('Informe o número da residência.');
      return;
    }
    if (!neighborhood.trim()) {
      setNeighborhoodError('Informe o bairro.');
      toast.error('Informe o bairro.');
      return;
    }
    if (!city.trim()) {
      setCityError('Informe a cidade.');
      toast.error('Informe a cidade.');
      return;
    }
    if (!state.trim() || state.trim().length !== 2) {
      setStateError('Informe a sigla do estado com 2 letras (ex: SP).');
      toast.error('Informe o estado (UF com 2 letras).');
      return;
    }

    // Trava Imediata no Front-End (Debounce / Anti-duplicação):
    isSubmittingCheckoutRef.current = true;
    setProcessingCheckout(true);

    try {
      const deliveryAddress: StoreDeliveryAddress = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase()
      };

      const result = await createStoreCheckoutPreference({
        productId: selectedProduct.id,
        deliveryAddress,
        userId: user?.uid || 'anonymous',
        userEmail: email.trim(),
        userName: fullName.trim()
      });

      if (result.init_point) {
        toast.success('Redirecionando para o Checkout Seguro do Mercado Pago...');
        // Manter a trava ativa enquanto redireciona o navegador
        window.location.href = result.init_point;
      } else {
        throw new Error('Link de pagamento não retornado');
      }
    } catch (err: any) {
      console.error('Erro ao criar checkout:', err);
      toast.error(err?.message || 'Erro ao iniciar pagamento no Mercado Pago.');
      setProcessingCheckout(false);
      isSubmittingCheckoutRef.current = false;
    }
  };

  // Filtros dinâmicos: categorias e pesquisa
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
      const matchesSearch = 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchTerm]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-24 transition-colors duration-200">
      {/* Header da Loja */}
      <div className="bg-white dark:bg-slate-900 px-5 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Loja Florescer</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Itens especiais para o seu momento com Deus
              </p>
            </div>
          </div>

          {/* Atalho para 'Meus Pedidos' */}
          <button
            onClick={() => onChangeTab?.('profile', 'orders')}
            className="flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-xl border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 transition-colors cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Meus Pedidos</span>
          </button>
        </div>

        {/* Barra de Pesquisa */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cadernos, bíblias, camisetas..."
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/30 transition-all placeholder:text-gray-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips Horizontais 100% Dinâmicos lendo store_categories */}
        <div 
          {...catDragProps}
          className="flex items-center gap-2 overflow-x-auto scrollbar-none scrollbar-hide no-scrollbar pt-3 pb-1 select-none touch-pan-x cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={() => {
              if (catHasDragged?.current) return;
              setSelectedCategoryId('all');
            }}
            className={cn(
              "px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
              selectedCategoryId === 'all'
                ? "bg-yellow-500 text-white shadow-sm shadow-yellow-500/30 scale-102"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            )}
          >
            Todos os Itens
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                if (catHasDragged?.current) return;
                setSelectedCategoryId(cat.id);
              }}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
                selectedCategoryId === cat.id
                  ? "bg-yellow-500 text-white shadow-sm shadow-yellow-500/30 scale-102"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo Principal / Grade de Produtos */}
      <div className="p-4 flex-1">
        {/* SKELETON LOADINGS: blocos cinzas animados enquanto os produtos são buscados */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-3 border border-gray-100 dark:border-slate-800 shadow-2xs animate-pulse">
                <div className="aspect-square bg-gray-200 dark:bg-slate-800 rounded-2xl w-full mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-slate-800 rounded-md w-1/3 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-md w-full mb-3" />
                <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded-md w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-gray-100 dark:border-slate-800 my-8 shadow-sm">
            <Package className="w-14 h-14 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="font-bold text-gray-800 dark:text-white text-base">Nenhum produto nesta categoria</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Experimente selecionar outra categoria acima ou limpar a busca.
            </p>
            {selectedCategoryId !== 'all' && (
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Ver Todos os Produtos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock <= 0 || product.isActive === false;
              const isScarcity = product.stock > 0 && product.stock <= 5;
              const category = categories.find((c) => c.id === product.categoryId);

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleOpenProductDetails(product)}
                  className={cn(
                    "bg-white dark:bg-slate-900 rounded-3xl p-3 border border-gray-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-all select-none relative group",
                    isOutOfStock
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:shadow-md hover:border-yellow-200 dark:hover:border-yellow-900/30 cursor-pointer active:scale-98"
                  )}
                >
                  <div>
                    {/* Imagem do Produto com Aspect Ratio Quadrado */}
                    <div className="relative aspect-square w-full rounded-2xl bg-gray-100 dark:bg-slate-800 overflow-hidden mb-2.5">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-700">
                          <ShoppingBag className="w-10 h-10" />
                        </div>
                      )}

                      {/* Gatilho de Escassez & Tag Esgotado */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                          Esgotado
                        </span>
                      ) : isScarcity ? (
                        <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse max-w-[calc(100%-16px)]">
                          <Flame className="w-3 h-3 fill-white shrink-0" />
                          <span className="truncate">Restam apenas {product.stock}!</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Categoria */}
                    <div className="text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 mb-1">
                      {category?.name || 'Florescer'}
                    </div>

                    {/* Título */}
                    <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-2 leading-snug">
                      {product.title}
                    </h3>
                  </div>

                  {/* Preço e Parcelamento sem cálculo exato de juros */}
                  <div className="mt-3 pt-2 border-t border-gray-50 dark:border-slate-800/80">
                    <div className="text-base font-black text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      ou em até 12x no cartão
                    </div>

                    <button
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isOutOfStock) handleStartCheckout(product);
                      }}
                      className={cn(
                        "w-full mt-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        isOutOfStock
                          ? "bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                          : "bg-yellow-500 hover:bg-yellow-600 text-white shadow-xs shadow-yellow-500/20 active:scale-98"
                      )}
                    >
                      {isOutOfStock ? 'Esgotado' : 'Comprar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL DETALHES DO PRODUTO (CARROSSEL + DESCRIÇÃO)
          ======================================================== */}
      {selectedProduct && !checkoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-200 flex flex-col justify-between">
            {/* Header do Modal com Fechar */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                Detalhes do Produto
              </span>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Carrossel de Fotos */}
              <div className="space-y-2">
                <div className="relative aspect-square w-full rounded-2xl bg-gray-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <img
                      src={selectedProduct.images[currentImageIndex] || selectedProduct.images[0]}
                      alt={selectedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag className="w-12 h-12" />
                    </div>
                  )}

                  {/* Setas de navegação do carrossel */}
                  {selectedProduct.images && selectedProduct.images.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((prev) =>
                            prev === 0 ? selectedProduct.images.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentImageIndex((prev) =>
                            prev === selectedProduct.images.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Miniaturas de Fotos */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedProduct.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={cn(
                          "w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer",
                          currentImageIndex === idx
                            ? "border-yellow-500 scale-105"
                            : "border-gray-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                        )}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações */}
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                  {selectedProduct.title}
                </h2>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedProduct.price)}
                  </span>
                  <span className="text-xs text-gray-400">ou em até 12x no cartão</span>
                </div>

                {/* Gatilho de Escassez */}
                {selectedProduct.stock > 0 && selectedProduct.stock <= 5 && (
                  <div className="mt-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl flex items-center gap-2 text-xs font-bold">
                    <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>Atenção: Restam apenas {selectedProduct.stock} unidades disponíveis!</span>
                  </div>
                )}

                {/* Descrição */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Sobre o Produto
                  </h4>
                  <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {selectedProduct.description || 'Produto oficial Florescer Devocional.'}
                  </div>
                </div>

                {/* Benefícios */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-green-500" />
                    <span>Envio para todo o Brasil</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span>Checkout Mercado Pago</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé Fixo com Botão Comprar */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 sticky bottom-0">
              <button
                onClick={() => setCheckoutModalOpen(true)}
                className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-600 text-white font-black text-sm rounded-2xl shadow-md shadow-yellow-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Comprar Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE CHECKOUT & ENDEREÇO DE ENTREGA
          ======================================================== */}
      {checkoutModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-200">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-yellow-500" />
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Endereço de Entrega</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCheckout} className="p-5 space-y-4">
              {/* Resumo do Produto */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700 overflow-hidden shrink-0">
                  {selectedProduct.images?.[0] && (
                    <img src={selectedProduct.images[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-gray-900 dark:text-white truncate">
                    {selectedProduct.title}
                  </div>
                  <div className="text-xs font-black text-yellow-600 dark:text-yellow-400 mt-0.5">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedProduct.price)}
                  </div>
                </div>
              </div>

              {/* Dados do Destinatário */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nome Completo do Destinatário *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  placeholder="Nome de quem vai receber o pacote"
                  className={cn(
                    "w-full bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                    fullNameError
                      ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                      : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                  )}
                  required
                />
                {fullNameError && (
                  <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fullNameError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    E-mail (Rastreio) *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="seu@email.com"
                    className={cn(
                      "w-full bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                      emailError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {emailError && (
                    <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    maxLength={15}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={cn(
                      "w-full bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all font-mono",
                      phoneError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {phoneError && (
                    <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{phoneError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* CEP com Busca Automática & Fallback Manual */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    CEP *
                  </label>
                  {loadingCep ? (
                    <span className="text-[10px] text-yellow-600 dark:text-yellow-400 flex items-center gap-1 font-semibold">
                      <Loader2 className="w-3 h-3 animate-spin" /> Consultando ViaCEP...
                    </span>
                  ) : cepStatus === 'valid' ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Preenchido via CEP
                    </span>
                  ) : cepStatus === 'fallback' || cepWarning ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3 h-3" /> Preenchimento manual
                    </span>
                  ) : cepError ? (
                    <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold">
                      <AlertCircle className="w-3 h-3" /> Incompleto
                    </span>
                  ) : null}
                </div>
                <input
                  type="text"
                  maxLength={9}
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  className={cn(
                    "w-full bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-mono transition-all",
                    cepError
                      ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                      : cepStatus === 'fallback' || cepWarning
                      ? "border-amber-400 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10 focus:ring-2 focus:ring-amber-500/30"
                      : cepStatus === 'valid'
                      ? "border-emerald-500/50 dark:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20"
                      : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                  )}
                  required
                />
                {cepWarning && (
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium mt-1.5 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{cepWarning}</span>
                  </div>
                )}
                {cepError && (
                  <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{cepError}</span>
                  </p>
                )}
              </div>

              {/* Barra Informativa se campos foram bloqueados pelo ViaCEP com opção de editar */}
              {isAddressLocked && (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Endereço preenchido via CEP</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddressLocked(false)}
                    className="text-xs text-yellow-700 dark:text-yellow-400 font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-2"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                </div>
              )}

              {/* Endereço */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Rua / Avenida *
                  </label>
                  <input
                    type="text"
                    value={street}
                    readOnly={isAddressLocked}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      if (e.target.value.trim()) setStreetError('');
                    }}
                    placeholder="Rua das Flores"
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                      isAddressLocked 
                        ? "bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 cursor-default" 
                        : "bg-gray-50 dark:bg-slate-800",
                      streetError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {streetError && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">{streetError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      if (e.target.value.trim()) setNumberError('');
                    }}
                    placeholder="123"
                    className={cn(
                      "w-full bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                      numberError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {numberError && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">{numberError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Apto, Bloco (opcional)"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Bairro *
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    readOnly={isAddressLocked}
                    onChange={(e) => {
                      setNeighborhood(e.target.value);
                      if (e.target.value.trim()) setNeighborhoodError('');
                    }}
                    placeholder="Centro"
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                      isAddressLocked 
                        ? "bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 cursor-default" 
                        : "bg-gray-50 dark:bg-slate-800",
                      neighborhoodError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {neighborhoodError && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">{neighborhoodError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    value={city}
                    readOnly={isAddressLocked}
                    onChange={(e) => {
                      setCity(e.target.value);
                      if (e.target.value.trim()) setCityError('');
                    }}
                    placeholder="São Paulo"
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white transition-all",
                      isAddressLocked 
                        ? "bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 cursor-default" 
                        : "bg-gray-50 dark:bg-slate-800",
                      cityError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {cityError && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">{cityError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    UF *
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={state}
                    readOnly={isAddressLocked}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
                      setState(clean);
                      if (clean.length === 2) setStateError('');
                    }}
                    placeholder="SP"
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-mono uppercase transition-all text-center",
                      isAddressLocked 
                        ? "bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-300 cursor-default" 
                        : "bg-gray-50 dark:bg-slate-800",
                      stateError
                        ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/30"
                        : "border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-yellow-500/30"
                    )}
                    required
                  />
                  {stateError && (
                    <p className="text-[10px] text-red-500 font-medium mt-0.5 text-center">{stateError}</p>
                  )}
                </div>
              </div>

              {/* Botão de Finalização & Travas de Segurança */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid || processingCheckout}
                  className={cn(
                    "w-full py-3.5 font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 select-none",
                    isFormValid && !processingCheckout
                      ? "bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/25 cursor-pointer active:scale-98"
                      : "bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none opacity-80"
                  )}
                >
                  {processingCheckout ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gerando Pagamento Seguro...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Ir para Pagamento (Mercado Pago)</span>
                    </>
                  )}
                </button>

                {!isFormValid ? (
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40 mt-2.5 text-center">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Preencha todos os campos obrigatórios (*) com dados válidos para prosseguir.</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Checkout seguro Mercado Pago. Aceita PIX e Cartão em até 12x.</span>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
