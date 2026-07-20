// apps/server/src/infra/migrations.ts
// Purpose: apply the pre-existing SQL migration directory from an explicit one-shot database-platform workload.
// Boundary: this module is not imported by the long-running Runtime server; callers must provide a database pool and explicit file policy.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import type { Pool } from "pg";

export type SqlMigrationRunOptions = {
  include_files?: readonly string[];
  exclude_files?: readonly string[];
};

export type SqlMigrationRunSummary = {
  migrations_dir: string;
  checked_dirs: string[];
  sql_file_count: number;
  selected_file_count: number;
  applied_file_count: number;
  skipped_empty_file_count: number;
  migration_files: string[];
  excluded_migration_files: string[];
};

function compareSqlMigrationNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function resolveMigrationsDirectory(): { migrationsDir: string; candidateDirs: string[] } {
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
  return { migrationsDir, candidateDirs };
}

export function listSqlMigrationFiles(options: SqlMigrationRunOptions = {}): {
  migrations_dir: string;
  checked_dirs: string[];
  all_files: string[];
  selected_files: string[];
  excluded_files: string[];
} {
  const { migrationsDir, candidateDirs } = resolveMigrationsDirectory();
  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort(compareSqlMigrationNames);
  const include = options.include_files ? new Set(options.include_files) : null;
  const exclude = new Set(options.exclude_files ?? []);
  const selectedFiles = allFiles.filter((name) => (!include || include.has(name)) && !exclude.has(name));
  const excludedFiles = allFiles.filter((name) => !selectedFiles.includes(name));
  if (include) {
    for (const required of include) {
      if (!allFiles.includes(required)) throw new Error(`SQL_MIGRATION_FILE_NOT_FOUND:${required}`);
    }
  }
  return {
    migrations_dir: migrationsDir,
    checked_dirs: candidateDirs,
    all_files: allFiles,
    selected_files: selectedFiles,
    excluded_files: excludedFiles,
  };
}

export async function runSqlMigrations(
  pool: Pool,
  options: SqlMigrationRunOptions = {},
): Promise<SqlMigrationRunSummary> {
  const inventory = listSqlMigrationFiles(options);
  let appliedFileCount = 0;
  let skippedEmptyFileCount = 0;

  for (const name of inventory.selected_files) {
    const fullPath = path.join(inventory.migrations_dir, name);
    const sql = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "").trim();
    if (!sql) {
      skippedEmptyFileCount += 1;
      continue;
    }
    await pool.query(sql);
    appliedFileCount += 1;
  }

  return {
    migrations_dir: inventory.migrations_dir,
    checked_dirs: inventory.checked_dirs,
    sql_file_count: inventory.all_files.length,
    selected_file_count: inventory.selected_files.length,
    applied_file_count: appliedFileCount,
    skipped_empty_file_count: skippedEmptyFileCount,
    migration_files: inventory.selected_files,
    excluded_migration_files: inventory.excluded_files,
  };
}
