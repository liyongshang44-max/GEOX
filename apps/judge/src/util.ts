import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function nowMs(): number {
  return Date.now();
}

export function newId(prefix: string): string {
  // deterministic IDs are not required; run_id uniqueness is required.
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function newRunId(): string {
  return randomUUID();
}

export function stableStringify(value: any): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function canonicalize(x: any): any {
  if (x === null || x === undefined) return x;
  if (Array.isArray(x)) {
    return x.map(canonicalize);
  }
  if (typeof x === "object") {
    const out: any = {};
    const keys = Object.keys(x).sort();
    for (const k of keys) out[k] = canonicalize(x[k]);
    return out;
  }
  return x;
}

export function assertString(v: unknown, name: string): string {
  if (typeof v !== "string" || v.trim().length === 0) throw new Error(`invalid ${name}`);
  return v.trim();
}

export function assertInt(v: unknown, name: string): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid ${name}`);
  return n;
}

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Find repo root by walking upward from `startDir` until `requiredRelativePath` exists.
 *
 * Why:
 * - In pnpm workspaces, process.cwd() may be either repo root or a package subdir.
 * - SSOT files (e.g., config/judge/default.json) live at the repo root.
 *
 * Contract:
 * - Returns an absolute directory path.
 * - Throws if the root cannot be found within `maxHops`.
 */
export function findRepoRoot(startDir: string, requiredRelativePath: string, maxHops = 8): string {
  // Normalize to an absolute directory path.
  let cur = path.resolve(startDir);

  for (let hop = 0; hop <= maxHops; hop++) {
    const probe = path.join(cur, requiredRelativePath);
    if (fs.existsSync(probe)) return cur;

    const parent = path.dirname(cur);
    if (parent === cur) break; // reached filesystem root
    cur = parent;
  }

  throw new Error(`Cannot locate repo root from ${startDir}; missing ${requiredRelativePath}`);
}
