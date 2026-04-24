import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { Pool } from "pg";

export async function runSqlMigrations(pool: Pool): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidateDirs = [
    path.resolve(process.cwd(), "apps", "server", "db", "migrations"),
    path.resolve(process.cwd(), "db", "migrations"),
    path.resolve(__dirname, "..", "..", "db", "migrations"),
    path.resolve(__dirname, "..", "db", "migrations"),
  ];

  const migrationsDir = candidateDirs.find((dir) => fs.existsSync(dir));

  if (!migrationsDir) {
    throw new Error(`SQL migrations directory not found. Checked: ${candidateDirs.join(", ")}`);
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
