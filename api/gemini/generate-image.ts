import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

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
    const { prompt } = req.body || {};
    let geminiApiKey = process.env.GEMINI_API_KEY;
    let unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY;

    if (!unsplashApiKey) {
      return res.status(500).json({ error: "Chave UNSPLASH_ACCESS_KEY não configurada." });
    }

    let keywords = prompt || 'nature,landscape,peaceful';
    if (geminiApiKey && prompt) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        try {
          const ai = new GoogleGenAI({ 
            apiKey: geminiApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          const response = await ai.models.generateContent({
            model, 
            contents: `Extract 2 to 3 main visual keywords in English from this prompt for a photo search. Return ONLY the keywords separated by comma, no extra text. Prompt: "${prompt}"`
          });
          if (response?.text) {
            keywords = response.text.trim();
            break;
          }
        } catch (e: any) {
          // Silent fallback to next model or default keyword extraction
          continue;
        }
      }
    }

    let unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(keywords)}&orientation=portrait&client_id=${unsplashApiKey}`;
    let unsplashRes = await fetch(unsplashUrl);
    if (!unsplashRes.ok) {
       unsplashUrl = `https://api.unsplash.com/photos/random?query=nature,landscape,peaceful&orientation=portrait&client_id=${unsplashApiKey}`;
       unsplashRes = await fetch(unsplashUrl);
       if (!unsplashRes.ok) {
           throw new Error(`Erro na API do Unsplash: ${unsplashRes.statusText}`);
       }
    }

    const unsplashData = await unsplashRes.json();
    const photoUrl = unsplashData.urls.regular;
    const photoResponse = await fetch(photoUrl);
    const arrayBuffer = await photoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = photoResponse.headers.get('content-type') || 'image/jpeg';
    return res.status(200).json({ image: `data:${mimeType};base64,${base64}` });
  } catch (error: any) {
    console.error("Error generating image:", error);
    return res.status(500).json({ error: error.message || "Failed to generate image" });
  }
}
