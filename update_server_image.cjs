const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const newRoute = `
app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY do servidor não configurada." });
    }
    
    // We will use generateImages with imagen-3.0-generate-002
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '9:16',
        outputMimeType: 'image/jpeg'
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64Image = response.generatedImages[0].image.imageBytes;
      res.json({ image: \`data:image/jpeg;base64,\${base64Image}\` });
    } else {
      throw new Error("No image generated");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: error.message || "Failed to generate image" });
  }
});
`;

content = content.replace('app.get("/api/cron/daily-push"', newRoute + '\napp.get("/api/cron/daily-push"');
fs.writeFileSync(file, content);
console.log('Patched server.ts with generate-image');
