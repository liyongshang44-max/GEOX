import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export type ServerConfig = {
  host: string;
  port: number;
  databaseUrl: string;
  systemProfile: string;
  disableAppleII: boolean;
  tenantHeaders: readonly string[];
  apiContractHeaders: readonly string[];
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

export function resolveServerConfig(): ServerConfig {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
  }

  const systemProfile = process.env.GEOX_SYSTEM_PROFILE ?? "dev";
  const disableAppleII = (process.env.GEOX_DISABLE_APPLE_II ?? "") === "1";

  if (systemProfile === "commercial_v0" && disableAppleII) {
    throw new Error("Apple II is required in commercial_v0 profile; refusing to start with GEOX_DISABLE_APPLE_II=1");
  }

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    databaseUrl,
    systemProfile,
    disableAppleII,
    tenantHeaders: ["x-tenant-id", "x-project-id", "x-group-id"],
    apiContractHeaders: ["x-api-contract-version", "x-api-contract-required"],
  };
}
