import app from './api/index';
import path from 'path';
import express from 'express';

async function setupVite() {
  // Vite middleware for development
  const PORT = 3000;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    if (process.env.START_SERVER === 'true') {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Production server running on port ${PORT}`);
      });
    }
  }
}

setupVite();

// Agendamento diário em segundo plano para verificação de entregas dos Correios (1x ao dia)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setTimeout(() => {
  fetch('http://127.0.0.1:3000/api/cron/check-deliveries', { method: 'POST' }).catch(() => {});
  setInterval(() => {
    fetch('http://127.0.0.1:3000/api/cron/check-deliveries', { method: 'POST' }).catch(() => {});
  }, ONE_DAY_MS);
}, 20000);

export default app;
