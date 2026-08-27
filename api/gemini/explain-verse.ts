import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { reference, text, bookName, chapter, verseNumbers } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada no servidor ou na Vercel." 
      });
    }

    if (!reference || !text) {
      return res.status(400).json({ 
        error: "Passagem ou versículo não informado para explicação." 
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

    const prompt = `Analise e explique o seguinte versículo bíblico:
Referência: ${reference}
Texto Sagrado: "${text}"

Por favor, forneça:
1. "context": O contexto histórico, cultural ou teológico de onde o versículo está inserido de forma clara e acessível.
2. "meaning": O significado profundo e espiritual da mensagem.
3. "practicalApplication": Como aplicar essa verdade na vida prática, no dia a dia e nas decisões cotidianas hoje.
4. "shortPrayer": Uma oração curta e sincera (1 ou 2 frases) inspirada na passagem.

Mantenha o tom empático, pastoral, acolhedor e edificante em até 3 parágrafos curtos no total.`;

    const systemInstruction = `Você é um teólogo e pastor empático. Explique de forma clara, acessível e devocional o significado do versículo bíblico fornecido. Traga o contexto histórico se necessário, mas foque em como aplicar essa palavra na vida prática hoje. Mantenha a resposta em até 3 parágrafos curtos. Retorne estritamente o formato JSON estruturado.`;

    const modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                context: { type: Type.STRING, description: "Contexto histórico e teológico resumido" },
                meaning: { type: Type.STRING, description: "Significado da mensagem" },
                practicalApplication: { type: Type.STRING, description: "Aplicação prática para hoje" },
                shortPrayer: { type: Type.STRING, description: "Oração curta de 1 a 2 frases" }
              },
              required: ["context", "meaning", "practicalApplication", "shortPrayer"]
            }
          }
        });

        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini explain-verse] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Os servidores de IA estão com alta demanda temporária. Por favor, tente novamente em alguns instantes.");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(cleanText);
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/explain-verse:", error);
    return res.status(500).json({ error: error.message || "Falha ao consultar o Teólogo Particular com IA." });
  }
}
