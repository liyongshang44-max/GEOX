// apps/server/src/infra/migrations.ts
// Purpose: apply SQL migration files during server startup and return a diagnostic summary for startup/preflight visibility.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { Pool } from "pg";

export type SqlMigrationRunSummary = {
  migrations_dir: string;
  checked_dirs: string[];
  sql_file_count: number;
  applied_file_count: number;
  skipped_empty_file_count: number;
  migration_files: string[];
};

function compareSqlMigrationNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export async function runSqlMigrations(pool: Pool): Promise<SqlMigrationRunSummary> {
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
    throw new Error(`SQL_MIGRATIONS_DIRECTORY_NOT_FOUND:${candidateDirs.join(",")}`);
  }

  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort(compareSqlMigrationNames);
  let appliedFileCount = 0;
  let skippedEmptyFileCount = 0;

  for (const name of files) {
    const fullPath = path.join(migrationsDir, name);
    const sql = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "").trim();
    if (!sql) {
      skippedEmptyFileCount += 1;
      continue;
    }
    await pool.query(sql);
    appliedFileCount += 1;
  }

  return {
    migrations_dir: migrationsDir,
    checked_dirs: candidateDirs,
    sql_file_count: files.length,
    applied_file_count: appliedFileCount,
    skipped_empty_file_count: skippedEmptyFileCount,
    migration_files: files,
  };
}
