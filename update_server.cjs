const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Firebase safely parsing
code = code.replace(
  'const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);',
  'const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;\n    const cleanKey = rawKey.replace(/\\\\n/g, \'\\n\');\n    const serviceAccount = JSON.parse(cleanKey);'
);

// 2. Remove gemini API key client overrides (generate)
code = code.replace(
  /const authHeader = req\.headers\.authorization;\s*let apiKey = process\.env\.GEMINI_API_KEY;\s*if \(authHeader && authHeader\.startsWith\('Bearer '\)\) \{\s*const userKey = authHeader\.substring\(7\)\.trim\(\);\s*if \(userKey\) \{\s*apiKey = userKey;\s*\}\s*\}\s*if \(!apiKey\) \{\s*return res\.status\(401\)\.json\(\{ error: "A chave da API é obrigatória. Configure-a no seu Perfil." \}\);\s*\}/,
  'let apiKey = process.env.GEMINI_API_KEY;\n      if (!apiKey) {\n        return res.status(500).json({ error: "Chave da API do servidor não configurada." });\n      }'
);

// 3. Remove gemini API key client overrides (generateBulk)
code = code.replace(
  /const authHeader = req\.headers\.authorization;\s*let apiKey = process\.env\.GEMINI_API_KEY;\s*if \(authHeader && authHeader\.startsWith\('Bearer '\)\) \{\s*const userKey = authHeader\.substring\(7\)\.trim\(\);\s*if \(userKey\) \{\s*apiKey = userKey;\s*\}\s*\}\s*if \(!apiKey\) \{\s*return res\.status\(401\)\.json\(\{ error: "A chave da API é obrigatória." \}\);\s*\}/,
  'let apiKey = process.env.GEMINI_API_KEY;\n      if (!apiKey) {\n        return res.status(500).json({ error: "Chave da API do servidor não configurada." });\n      }'
);

// 4. Adapt app creation and startServer logic for Vercel
// We will move `const app = express();` to the top level, right below the client declaration.
// And export `app`.
let appMove = `const app = express();\n\n// Move startServer contents here\nasync function startServer() {\n  // empty\n}`;

code = code.replace(
  'async function startServer() {\n  const app = express();\n  const PORT = 3000;\n\n  app.use(express.json());',
  'const app = express();\napp.use(express.json());\n\nasync function setupVite() {'
);

// Find the vite middleware block and port listening
const searchViteStr = `  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
  });
}

startServer();`;

const replacementViteStr = `  // Vite middleware for development
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(\`Server running on http://0.0.0.0:\${PORT}\`);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    // In Vercel, this won't be reached because Vercel handles static serving
    // For standard docker deployments:
    if (process.env.START_SERVER === 'true') {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(\`Production server running on port \${PORT}\`);
      });
    }
  }
}

setupVite();

export default app;`;

code = code.replace(searchViteStr, replacementViteStr);

fs.writeFileSync('server.ts', code);
