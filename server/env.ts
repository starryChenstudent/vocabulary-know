import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

function applyEnvLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  const eq = trimmed.indexOf('=');
  if (eq <= 0) return;

  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

export function loadEnvFile(): void {
  const candidates = [
    path.join(rootDir, '.env'),
    path.join(process.cwd(), '.env'),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      applyEnvLine(line);
    }
    break;
  }
}

loadEnvFile();
