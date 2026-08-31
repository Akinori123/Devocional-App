import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

// Lista de URLs de backup de alta qualidade caso todas as APIs externas sofram indisponibilidade
const CURATED_CHRISTIAN_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&auto=format&fit=crop&q=80', // Amanhecer na praia
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&auto=format&fit=crop&q=80', // Montanhas majestosas
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1080&auto=format&fit=crop&q=80', // Luz suave entre árvores
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&auto=format&fit=crop&q=80', // Céu estrelado sereno
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1080&auto=format&fit=crop&q=80', // Flores desabrochando ao sol
  'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=1080&auto=format&fit=crop&q=80', // Campo calmo ao entardecer
];

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
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY;

    let visualPrompt = prompt?.trim() || 'peaceful biblical sunrise over mountains, golden light, spiritual serenity';
    let englishKeywords = 'nature,peaceful,sunrise,spiritual';

    // 1. Otimização Inteligente do Prompt com Gemini (se disponível)
    if (geminiApiKey && prompt?.trim()) {
      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash'];
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
            contents: `Transform this user input into a detailed, poetic and visual English photography prompt for a vertical wallpaper (Stories 9:16), cinematic, serene and beautiful. Avoid people faces or text. Prompt: "${prompt}"`
          });
          if (response?.text) {
            visualPrompt = response.text.trim().replace(/["']/g, '');
            englishKeywords = visualPrompt.slice(0, 100);
            break;
          }
        } catch (e: any) {
          continue;
        }
      }
    }

    let imageBuffer: Buffer | null = null;
    let imageMimeType = 'image/jpeg';

    // 2. Método Principal: Geração de Imagem com IA (Pollinations AI turbo - rápido e estável)
    try {
      const seed = Math.floor(Math.random() * 900000) + 100000;
      const cleanVisualPrompt = encodeURIComponent(`${visualPrompt}, vertical wallpaper 9:16, aesthetic warm lighting, high quality`);
      const aiImageUrl = `https://image.pollinations.ai/prompt/${cleanVisualPrompt}?width=540&height=960&nologo=true&seed=${seed}&model=turbo`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout
      
      const aiRes = await fetch(aiImageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (aiRes.ok) {
        const arrayBuffer = await aiRes.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 1000) {
          imageBuffer = Buffer.from(arrayBuffer);
          imageMimeType = aiRes.headers.get('content-type') || 'image/jpeg';
        }
      }
    } catch (aiErr: any) {
      if (aiErr?.name !== 'AbortError') {
        console.warn('[Generate Image] Pollinations AI attempt failed, falling back:', aiErr?.message || aiErr);
      }
    }

    // 3. Fallback Unsplash (se a chave estiver configurada ou busca direta)
    if (!imageBuffer && unsplashApiKey) {
      try {
        let unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(englishKeywords)}&orientation=portrait&client_id=${unsplashApiKey}`;
        let unsplashRes = await fetch(unsplashUrl);
        if (!unsplashRes.ok) {
          unsplashUrl = `https://api.unsplash.com/photos/random?query=nature,landscape,peaceful&orientation=portrait&client_id=${unsplashApiKey}`;
          unsplashRes = await fetch(unsplashUrl);
        }
        if (unsplashRes.ok) {
          const unsplashData = await unsplashRes.json();
          const photoUrl = unsplashData.urls?.regular || unsplashData.urls?.small;
          if (photoUrl) {
            const photoRes = await fetch(photoUrl);
            const arrayBuffer = await photoRes.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            imageMimeType = photoRes.headers.get('content-type') || 'image/jpeg';
          }
        }
      } catch (unsplashErr) {
        console.warn('[Generate Image] Unsplash API fallback failed:', unsplashErr);
      }
    }

    // 4. Fallback de Segurança com Curated CDN
    if (!imageBuffer) {
      const randomIndex = Math.floor(Math.random() * CURATED_CHRISTIAN_BACKGROUNDS.length);
      const fallbackUrl = CURATED_CHRISTIAN_BACKGROUNDS[randomIndex];
      const fallbackRes = await fetch(fallbackUrl);
      const arrayBuffer = await fallbackRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      imageMimeType = fallbackRes.headers.get('content-type') || 'image/jpeg';
    }

    const base64 = imageBuffer.toString('base64');
    return res.status(200).json({ 
      image: `data:${imageMimeType};base64,${base64}`,
      prompt: visualPrompt 
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    let msg = error?.message || "Não foi possível gerar a imagem no momento.";
    return res.status(500).json({ error: msg });
  }
}
