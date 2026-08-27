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
    const { theme, userName, faithLevel, currentNeed, originalVerse } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não encontrada nas variáveis de ambiente da Vercel. Verifique as configurações do projeto na Vercel." 
      });
    }

    if (!theme || typeof theme !== 'string' || !theme.trim()) {
      return res.status(400).json({ 
        error: "Por favor, informe um tema ou palavra-chave para gerar o devocional." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let contextDetails = "";
    if (userName) contextDetails += ` Nome do leitor: ${userName}.`;
    if (faithLevel) contextDetails += ` Caminhada na fé: ${faithLevel}.`;
    if (currentNeed) contextDetails += ` Necessidade espiritual ou momento atual: ${currentNeed}.`;
    if (originalVerse) contextDetails += ` Versículo ou passagem inspiradora base: "${originalVerse}".`;

    const prompt = `Escreva um devocional cristão edificante, inédito e acolhedor focado estritamente no tema: "${theme.trim()}".${contextDetails}

REQUISITOS ESSENCIAIS:
1. Idioma: Português do Brasil.
2. Tamanho: Conciso e profundo (140 a 200 palavras).
3. "title": Um título criativo, poético e inspirador.
4. "beautifulWord": Um versículo bíblico chave acompanhado da sua referência exata (ex: 'Porque estou certo de que... (Romanos 8:38-39)' ou 'O Senhor é o meu pastor... (Salmos 23:1)').
5. "content": O texto do devocional com reflexão prática e conforto espiritual, finalizando com uma oração curta que inicie obrigatoriamente com '**Oração:** ...'.

Retorne estritamente o JSON com as chaves title, beautifulWord e content.`;

    const modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um pastor e conselheiro cristão acolhedor, bíblico e sábio. Sua missão é criar reflexões devocionais de alta qualidade. Retorne ESTRITAMENTE o JSON solicitado.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                beautifulWord: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "beautifulWord", "content"]
            }
          }
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini generate-devotional] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Os servidores de IA estão com alta demanda temporária. Por favor, tente novamente em alguns segundos.");
    }

    const text = response.text;

    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(cleanText);
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/generate-devotional:", error);
    return res.status(500).json({ error: error.message || "Falha ao gerar devocional com IA" });
  }
}
