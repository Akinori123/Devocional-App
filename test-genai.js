import { GoogleGenAI, Type } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Hello',
}).then(res => {
  console.log("Is text a function?", typeof res.text === 'function');
  console.log("Is text a string?", typeof res.text === 'string');
}).catch(console.error);
