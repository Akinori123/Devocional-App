export type TabType = 'home' | 'bible' | 'journey' | 'store' | 'profile' | 'videoHistory' | 'usersAdmin';

export interface StoreCategory {
  id: string;
  name: string;
  order: number;
}

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  categoryId: string;
  isActive: boolean;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
}

export type StoreOrderStatus = 
  | 'Aguardando Pagamento' 
  | 'Preparando Envio' 
  | 'Enviado' 
  | 'Entregue' 
  | 'Cancelamento Solicitado'
  | 'Em Análise (Inquérito)'
  | 'Devolução Aprovada'
  | 'Reembolsado'
  | 'Cancelado';

export interface StoreDeliveryAddress {
  fullName?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export interface StoreOrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface StoreOrder {
  orderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  productId: string;
  productName: string;
  productImage?: string;
  unitPrice?: number;
  quantity?: number;
  subtotal?: number;
  items?: StoreOrderItem[];
  totalPrice: number;
  status: StoreOrderStatus;
  trackingCode?: string;
  deliveryAddress?: StoreDeliveryAddress;
  paymentId?: string;
  mpPaymentId?: string;
  deliveredAt?: string;
  autoDeliveredViaCron?: boolean;
  cancellationReason?: string;
  disputeReason?: string;
  returnTrackingCode?: string;
  returnInstructions?: string;
  refundedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BibleLastRead {
  bookId: string;
  bookName: string;
  chapter: number;
  readAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  subscriptionStatus: 'free' | 'premium' | 'canceled' | 'expired' | 'active' | 'authorized';
  subscriptionType?: 'pix_prepaid' | 'credit_card_recurring' | 'admin_grant';
  subscriptionExpiresAt?: string;
  cancelAtPeriodEnd?: boolean;
  mpSubscriptionId?: string;
  lastProcessedPaymentId?: string;
  createdAt: number;
  isAdmin?: boolean;
  isBanned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  bibleProgress?: Record<string, number[]>;
  lastReadReference?: BibleLastRead;
  coins?: number;
  lastCoinDate?: string;
  claimedDailyMissions?: string[];
  unlockedSecretModules?: string[];
  unlocked_modules?: string[];
}

export interface VideoItem {
  id: string;
  videoId: string;
  verseText: string;
  verseRef: string;
  isExclusive?: boolean;
  isPremium?: boolean;
  createdAt: string;
}

export interface Devotional {
  devotionalId: string;
  title: string;
  description: string;
  totalDays: number;
  coverImageUrl: string;
  isPremium: boolean;
  visibility?: 'free' | 'vip' | 'secret';
  coinCost?: number;
}

export interface UserProgress {
  progressId: string;
  userId: string;
  devotionalId: string;
  currentDay: number;
  completedDays: number[];
  lastReadAt: number;
}

export interface Note {
  noteId: string;
  userId: string;
  verseReference: string;
  content: string;
  createdAt: number;
}

export type HighlightColor = 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'blue' | 'teal' | 'green';

export interface BibleHighlight {
  id: string;
  book: string;
  bookName?: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  text?: string;
  updatedAt?: any;
  createdAt?: any;
}

