import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: Request, res: Response) {
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
    const { theme, partNumber } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada na Vercel." });
    }

    if (!theme) {
      return res.status(400).json({ error: "Tema é obrigatório." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let prompt = `Crie exatamente 7 devocionais cristãos inéditos focados ESTRITAMENTE no tema: "${theme}". Eles formarão um módulo de 7 dias de leitura contínua. Cada dia deve abordar um aspecto diferente desse tema para garantir crescimento progressivo.\n\nINSTRUÇÕES:\n1. Ortografia em Português (Brasil).\n2. Crie 7 objetos diferentes no array.\n3. O versículo base não deve se repetir.\n4. Cada reflexão deve ter entre 120 e 200 palavras (concisa, profunda, encorajadora e direta ao ponto), seguida de uma oração curta ao final no formato '**Oração:** ...'.`;
    
    if (partNumber && partNumber > 1) {
      prompt = `Este é o volume ${partNumber} sobre o tema "${theme}". Gere 7 novos dias com abordagens mais profundas e avançadas, não repita os conceitos básicos dos volumes anteriores.\n\nINSTRUÇÕES:\n1. Ortografia em Português (Brasil).\n2. Crie 7 objetos diferentes no array.\n3. O versículo base não deve se repetir.\n4. Cada reflexão deve ter entre 120 e 200 palavras, seguida de uma oração curta ao final no formato '**Oração:** ...'.`;
    }

    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um conselheiro cristão sábio e acolhedor. Sua missão é escrever um módulo de 7 dias de devocionais sobre um tema específico. Retorne EXATAMENTE um array JSON contendo 7 objetos.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  beautifulWord: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["title", "beautifulWord", "content"]
              }
            }
          }
        });
        if (response?.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini bulk] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Os servidores de IA estão com alta demanda temporária. Por favor, tente novamente em alguns instantes.");
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
    console.error("Error generating bulk devotionals:", error);
    let msg = error?.message || "Failed to generate bulk devotionals";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Por favor, aguarde 30 a 60 segundos e tente novamente.";
    }
    return res.status(500).json({ error: msg });
  }
}
