/**
 * Constantes Oficiais de Suporte e Contato - Florescer
 */

// 1. Suporte a Pedidos, Rastreios e Loja
export const WHATSAPP_ORDERS_PHONE = '5542999795021';
export const WHATSAPP_ORDERS_FORMATTED = '(42) 99979-5021';

// 2. Atendimento Geral, Dúvidas e Sugestões do Aplicativo
export const WHATSAPP_GENERAL_PHONE = '554299657408';
export const WHATSAPP_GENERAL_FORMATTED = '(42) 9965-7408';

// Retrocompatibilidade
export const WHATSAPP_SUPPORT_PHONE = WHATSAPP_ORDERS_PHONE;
export const WHATSAPP_BACKUP_PHONE = WHATSAPP_GENERAL_PHONE;

/**
 * Gera URL oficial da API do WhatsApp com telefone limpo (DDI + DDD)
 */
export function getWhatsAppSupportUrl(message: string, phone: string = WHATSAPP_SUPPORT_PHONE): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

