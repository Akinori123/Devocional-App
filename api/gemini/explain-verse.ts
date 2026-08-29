import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb(): FirebaseFirestore.Firestore | null {
  try {
    if (!getApps().length) {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const projectId = process.env.FIREBASE_PROJECT_ID || 'devocional-app-63871';

      if (serviceAccountKey) {
        try {
          let parsed: any;
          // Suporte a JSON direto ou Base64
          if (serviceAccountKey.trim().startsWith('{')) {
            parsed = JSON.parse(serviceAccountKey);
          } else {
            const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
            parsed = JSON.parse(decoded);
          }
          initializeApp({
            credential: cert(parsed)
          });
          console.log('[Firebase Admin] Inicializado com sucesso via FIREBASE_SERVICE_ACCOUNT_KEY');
        } catch (parseErr: any) {
          console.error('[Firebase Admin] Falha ao fazer parse de FIREBASE_SERVICE_ACCOUNT_KEY:', parseErr?.message || parseErr);
        }
      } else if (privateKey && clientEmail) {
        try {
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n')
            })
          });
          console.log('[Firebase Admin] Inicializado com sucesso via FIREBASE_PRIVATE_KEY e FIREBASE_CLIENT_EMAIL');
        } catch (credErr: any) {
          console.error('[Firebase Admin] Falha ao inicializar com credenciais avulsas:', credErr?.message || credErr);
        }
      } else {
        try {
          initializeApp({
            projectId
          });
          console.log(`[Firebase Admin] Inicializado com projectId padrão: ${projectId}`);
        } catch (e: any) {
          console.warn('[Firebase Admin] Inicialização sem credenciais completas:', e?.message || e);
        }
      }
    }
    return getFirestore();
  } catch (err: any) {
    console.error('[Firebase Admin] Erro geral ao obter Firestore:', err?.message || err);
    return null;
  }
}

export default async function handler(req: Request, res: Response) {
  // Configuração de cabeçalhos CORS
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
    const { reference, text, bookName, bookId, chapter, verseNumbers, cacheDocId: customCacheDocId } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!reference || !text) {
      return res.status(400).json({ 
        error: "Passagem ou versículo não informado para explicação." 
      });
    }

    // Calcula o doc ID padronizado do cache
    const cleanBookId = (bookId || bookName || reference || 'verse')
      .toLowerCase()
      .split(/[\s:]+/)[0]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');

    let versesStr = '1';
    if (Array.isArray(verseNumbers) && verseNumbers.length > 0) {
      versesStr = verseNumbers.join('-');
    } else if (typeof verseNumbers === 'string' || typeof verseNumbers === 'number') {
      versesStr = String(verseNumbers);
    } else if (reference) {
      const parts = reference.split(':');
      if (parts.length > 1) {
        versesStr = parts[1].replace(/\s+/g, '').replace(/,/g, '-');
      }
    }

    const chapterNum = chapter || 1;
    const cacheDocId = customCacheDocId || `${cleanBookId}_c${chapterNum}_v${versesStr}`;

    console.log(`[explain-verse] Iniciando processamento para ${reference} (cacheDocId: ${cacheDocId})`);

    // 1. VERIFICAÇÃO PRÉVIA NO CACHE DO FIRESTORE (ECONOMIA DE COTA)
    const adminDb = getAdminDb();

    if (adminDb && cacheDocId) {
      try {
        console.log(`[Cache Lookup] Consultando coleção 'bible_explanations', doc: '${cacheDocId}'...`);
        const cacheDoc = await adminDb.collection('bible_explanations').doc(cacheDocId).get();
        
        if (cacheDoc.exists) {
          const cachedData = cacheDoc.data();
          if (cachedData && (cachedData.context || cachedData.meaning)) {
            console.log(`[Cache HIT ⚡] Resposta recuperada instantaneamente do Firestore para ${cacheDocId}`);
            return res.status(200).json({
              reference: cachedData.reference || reference,
              text: cachedData.text || text,
              context: cachedData.context || '',
              meaning: cachedData.meaning || '',
              practicalApplication: cachedData.practicalApplication || '',
              shortPrayer: cachedData.shortPrayer || '',
              cached: true
            });
          }
        }
        console.log(`[Cache MISS 💨] Versículo '${cacheDocId}' não encontrado no cache. Chamando Gemini...`);
      } catch (cacheLookupErr: any) {
        console.warn(`[Cache Lookup Warning] Falha na consulta prévia do cache (${cacheDocId}):`, {
          code: cacheLookupErr?.code,
          message: cacheLookupErr?.message
        });
      }
    } else {
      console.warn(`[Cache Lookup Skip] Admin DB indisponível ou cacheDocId vazio.`);
    }

    if (!apiKey) {
      console.error("[Gemini Error] Chave GEMINI_API_KEY não configurada.");
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada no servidor ou na Vercel." 
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
        console.log(`[Gemini Request] Tentando gerar com modelo: ${model}...`);
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

        if (response?.text) {
          console.log(`[Gemini Success] Resposta gerada com sucesso pelo modelo ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Warning] Modelo ${model} falhou:`, err?.message || err);
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

    // 2. GRAVAÇÃO OBRIGATÓRIA NO FIRESTORE COM AWAIT ANTES DE RETORNAR STATUS 200
    if (adminDb && cacheDocId) {
      const payloadToSave = {
        reference: reference || '',
        text: text || '',
        bookId: bookId || cleanBookId,
        bookName: bookName || '',
        chapter: chapterNum,
        verseNumbers: Array.isArray(verseNumbers) ? verseNumbers : [1],
        context: parsed.context || '',
        meaning: parsed.meaning || '',
        practicalApplication: parsed.practicalApplication || '',
        shortPrayer: parsed.shortPrayer || '',
        createdAt: new Date().toISOString(),
        source: 'gemini-api'
      };

      try {
        console.log(`[Firestore Cache Save] Gravando obrigatoriamente no Firestore (coleção: bible_explanations, doc: ${cacheDocId})...`);
        const startTime = Date.now();
        
        // AWAIT OBRIGATÓRIO
        await adminDb.collection('bible_explanations').doc(cacheDocId).set(payloadToSave, { merge: true });
        
        const durationMs = Date.now() - startTime;
        console.log(`[Firestore Cache Save SUCESSO ✅] Versículo ${cacheDocId} gravado com sucesso no Firestore em ${durationMs}ms`);
      } catch (saveErr: any) {
        console.error(`[Firestore Cache Save ERRO ❌] Falha crítica ao gravar bible_explanations/${cacheDocId}:`, {
          code: saveErr?.code || 'UNKNOWN_CODE',
          message: saveErr?.message || saveErr,
          details: saveErr?.details || null,
          stack: saveErr?.stack || null
        });
      }
    } else {
      console.warn(`[Firestore Cache Save ALERTA ⚠️] Firestore Admin não disponível ou cacheDocId inválido:`, { 
        hasAdminDb: !!adminDb, 
        cacheDocId 
      });
    }

    // Retorna resposta 200 ao cliente após o salvamento
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/explain-verse:", error);
    let msg = error?.message || "Falha ao consultar o Teólogo Particular com IA.";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      return res.status(429).json({ 
        error: "Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos." 
      });
    }
    return res.status(500).json({ error: msg });
  }
}
