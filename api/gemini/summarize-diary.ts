import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { notes, period } = req.body || {};
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel." 
      });
    }

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: "Nenhuma reflexão fornecida para gerar o resumo espiritual." });
    }

    // Limitar para até 15 anotações e truncar cada anotação a no máximo 600 caracteres para proteção de tokens
    const sanitizedNotes = notes.slice(0, 15).map((n: any, i: number) => {
      const title = typeof n.title === 'string' && n.title.trim() ? ` [Título: ${n.title.trim()}]` : '';
      const date = typeof n.date === 'string' && n.date.trim() ? n.date.trim() : 'Data recente';
      let content = typeof n.content === 'string' ? n.content.trim() : '';
      if (content.length > 600) {
        content = content.substring(0, 597) + '...';
      }
      return `[Reflexão ${i + 1} - ${date}${title}]:\n${content}`;
    }).filter(t => t.length > 0);

    const notesSummaryText = sanitizedNotes.join('\n\n');

    const periodLabel = period === '7d' 
      ? 'dos últimos 7 dias' 
      : period === '30d' 
        ? 'do último mês' 
        : 'recentes';

    const prompt = `Você é um mentor e conselheiro espiritual cristão acolhedor, empático e sábio do aplicativo Florescer.
Abaixo estão as anotações e orações do diário espiritual de um usuário ${periodLabel}:

---
${notesSummaryText}
---

Sua missão é gerar um "Resumo Espiritual" caloroso, pastoral, reflexivo e altamente encorajador.
Retorne um JSON estruturado com os seguintes campos:
- "title": Título inspirador e poético que resume a essência do momento espiritual (ex: "Sua Jornada de Paz, Esperança e Confiança").
- "summary": Resumo geral reflexivo e afetuoso sobre os sentimentos, preces e crescimento expressos pelo usuário (2 a 3 parágrafos confortáveis e afetuosos).
- "spiritualHighlights": Array com 2 a 4 pontos de destaque ou temas centrais identificados nas anotações (strings curtas começando com um emoji, ex: "🌱 Cultivando paciência em momentos de espera").
- "verseGuidance": Versículo bíblico encorajador perfeito para a fase atual com a referência (ex: "O Senhor é o meu pastor; nada me faltará. (Salmos 23:1)").
- "personalPrayer": Uma oração pessoal, profunda e encorajadora para encerrar a leitura e abençoar a caminhada com Deus.`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.6-flash"
    ];

    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um mentor cristão afetuoso, sábio e bíblico. Retorne a resposta ESTRITAMENTE em formato JSON compatível com o schema solicitado.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                spiritualHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                verseGuidance: { type: Type.STRING },
                personalPrayer: { type: Type.STRING }
              },
              required: ["title", "summary", "spiritualHighlights", "verseGuidance", "personalPrayer"]
            }
          }
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Diary Summary Serverless] Model ${model} failed, attempting next:`, err?.message || err);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Serviço de IA temporariamente indisponível. Tente novamente em instantes.");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }
    const parsed = JSON.parse(cleanText);
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error summarizing diary in serverless route:", error);
    let msg = error?.message || "Failed to generate diary summary";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Aguarde 30 segundos e tente novamente.";
    }
    return res.status(500).json({ error: msg });
  }
}
