import Fastify from "fastify";

import { AppleIReader } from "./applei_reader";
import { JudgeRuntime } from "./runtime";
import { registerJudgeRoutes } from "./routes";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    // Strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Do not overwrite explicitly provided env vars
    if (process.env[key] == null) process.env[key] = val;
  }
}

function loadEnv(): void {
  // Load repo root .env first, then package-local .env to allow overrides.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  loadDotEnvFile(path.join(repoRoot, ".env"));
  loadDotEnvFile(path.join(__dirname, ".env"));
}

loadEnv();


const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

const app = Fastify({ logger: true });

app.addHook("onRequest", async (req, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Headers", "content-type");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return reply.code(204).send();
});

async function main(): Promise<void> {
  const reader = new AppleIReader(DATABASE_URL);
  await reader.ping();
  const runtime = new JudgeRuntime(reader);
  registerJudgeRoutes(app, runtime);

  const port = Number(process.env.PORT ?? 3102);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
