import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';
const distDir = path.resolve(__dirname, 'dist');
const distModelsDir = path.join(distDir, 'models');
const publicModelsDir = path.resolve(__dirname, 'public', 'models');
const modelsDir = fs.existsSync(distModelsDir) ? distModelsDir : publicModelsDir;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'smart-attendance-system',
    timestamp: new Date().toISOString(),
  });
});

// Serve face-api.js weights directly with explicit 404 (never fall back to index.html)
app.use(
  '/models',
  express.static(modelsDir, {
    maxAge: '7d',
    fallthrough: false,
  }),
);

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/models')) {
    res.status(404).json({ error: 'Face recognition model file not found.' });
    return;
  }
  next(err);
});

app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Smart Attendance Management System listening on http://${host}:${port}`);
});
