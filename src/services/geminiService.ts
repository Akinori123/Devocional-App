import { DevotionalItem } from '../data/devotionals';
import { recordApiUsage } from './apiMetricsService';

export async function generateDevotional(
  theme: string, 
  userName?: string, 
  faithLevel?: string, 
  currentNeed?: string,
  originalVerse?: string
): Promise<DevotionalItem> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const payload = JSON.stringify({ 
    theme: theme.trim(), 
    userName, 
    faithLevel, 
    currentNeed, 
    originalVerse 
  });

  let response: Response;

  try {
    response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers,
      body: payload,
    });
    
    // Fallback to alias route if 404
    if (response.status === 404) {
      console.warn("Rota /api/gemini/generate deu 404, tentando /api/gemini/generate-devotional...");
      response = await fetch('/api/gemini/generate-devotional', {
        method: 'POST',
        headers,
        body: payload,
      });
    }
  } catch (networkError: any) {
    throw new Error(`Falha de conexão com a API: ${networkError.message || 'Verifique sua internet'}`);
  }

  if (!response.ok) {
    let errorMsg = `Erro na geração (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMsg = errorData.error;
      }
    } catch {
      // response is not JSON
    }

    if (
      response.status === 429 || 
      errorMsg.includes('429') || 
      errorMsg.includes('RESOURCE_EXHAUSTED') || 
      errorMsg.includes('quota') ||
      errorMsg.includes('Limite')
    ) {
      throw new Error("Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos.");
    }

    if (response.status === 403) {
      throw new Error(errorMsg || 'Recurso Premium.');
    }
    if (response.status === 404) {
      throw new Error("Serviço de IA não encontrado (404). Verifique se o backend está atualizado.");
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  
  if (!data?.title || !data?.content) {
    throw new Error("A IA gerou uma resposta incompleta. Tente novamente com outro tema.");
  }

  // Registra consumo da API Gemini
  recordApiUsage('gemini');

  return {
    id: `ai-${Date.now()}`,
    theme: theme.trim(),
    title: data.title,
    description: "Gerado por Inteligência Artificial.",
    beautifulWord: data.beautifulWord || '',
    content: data.content,
  };
}

