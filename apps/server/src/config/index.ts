import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export type ServerConfig = {
  host: string;
  port: number;
  databaseUrl: string;
};

function loadDotEnvFile(fp: string): void {
  if (!fs.existsSync(fp)) return;
  const raw = fs.readFileSync(fp, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2] ?? "";
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

export function loadEnv(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  loadDotEnvFile(path.join(repoRoot, ".env"));
  loadDotEnvFile(path.join(__dirname, ".env"));
}

export function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL;
  if (typeof direct === "string" && direct.length) return direct;
  const host = process.env.PGHOST;
  const port = process.env.PGPORT;
  const user = process.env.PGUSER;
  const pass = process.env.PGPASSWORD;
  const db = process.env.PGDATABASE;
  if (host && port && user && db) {
    const cred = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}` : encodeURIComponent(user);
    return `postgres://${cred}@${host}:${port}/${db}`;
  }
  return "";
}

export function resolveServerConfig(): ServerConfig {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
  }

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    databaseUrl,
  };
}
