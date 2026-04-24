import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { Pool } from "pg";

export async function runSqlMigrations(pool: Pool): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.resolve(__dirname, "..", "db", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const fullPath = path.join(migrationsDir, name);
    const sql = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "").trim();
    if (!sql) {
      continue;
    }
    await pool.query(sql);
  }
}
