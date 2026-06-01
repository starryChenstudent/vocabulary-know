import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';

import { closeDb } from './db.js';
import { bootstrapAdmin } from './services/adminService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', apiRouter);

bootstrapAdmin();

const clientDist = path.join(__dirname, '../client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Vocabulary iknow server running on http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。请先停止旧进程：lsof -ti :${PORT} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close(() => {
    closeDb();
    process.exit(0);
  });

  setTimeout(() => {
    closeDb();
    process.exit(0);
  }, 2000).unref();
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
