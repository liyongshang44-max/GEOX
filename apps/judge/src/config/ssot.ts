// GEOX/apps/judge/src/config/ssot.ts
//
// Judge Config SSOT / Manifest helpers (Frozen Manifest v1).
//
// Contract:
// - SSOT file: config/judge/default.json
// - ssot_hash: sha256(stableStringify(parsedJson)) with "sha256:" prefix
// - manifest is the only editable capability source for the frontend

import fs from "node:fs";
import path from "node:path";

import { findRepoRoot, nowMs, sha256Hex, stableStringify } from "../util";

export type ManifestValueType = "int" | "number" | "bool" | "enum_list";

export type JudgeConfigEditableItem = {
  // Full dot path (e.g. "qc.bad_pct_threshold")
  path: string;

  // Input type for UI + validator
  type: ManifestValueType;

  // Numeric constraints (only for int/number)
  min?: number;
  max?: number;

  // Enum set (only for enum_list)
  enum?: string[];

  // Optional conditional gate
  // - exists_in_ssot: only editable if the path exists in default.json
  conditional?: "exists_in_ssot";

  // Human readable hint for UI (non-semantic)
  description?: string;
};

export type JudgeConfigManifestV1 = {
  ssot: {
    source: "config/judge/default.json";
    schema_version: string;
    ssot_hash: string;
    updated_at_ts: number;
  };
  patch: {
    patch_version: "1.0.0";
    op_allowed: ["replace"];
    unknown_keys_policy: "reject";
  };
  editable: JudgeConfigEditableItem[];
  defaults: Record<string, unknown>;
  read_only_hints: string[];
};

function resolveRepoRoot(): string {
  // 1) explicit override (CI / dev convenience)
  if (process.env.GEOX_REPO_ROOT) return path.resolve(process.env.GEOX_REPO_ROOT);

  // 2) docker mount root in this repo is /app (container convention)
  const dockerRoot = "/app";
  if (fs.existsSync(path.join(dockerRoot, "config", "judge", "default.json"))) return dockerRoot;

  // 3) local dev: walk upward from cwd until we find the SSOT file
  //    (prevents "apps/server" cwd from breaking SSOT resolution)
  return findRepoRoot(process.cwd(), "config/judge/default.json");
}

function readJsonFile(p: string): any {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

export function loadDefaultConfig(): any {
  const repoRoot = resolveRepoRoot();
  const p = path.join(repoRoot, "config", "judge", "default.json");
  return readJsonFile(p);
}

export function computeSsotHash(cfg: any): string {
  // canonical hash: stable stringify then sha256
  return `sha256:${sha256Hex(stableStringify(cfg))}`;
}

function hasPath(obj: any, dotPath: string): boolean {
  const parts = dotPath.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

function getPath(obj: any, dotPath: string): any {
  const parts = dotPath.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

export function validateEffectiveConfig(cfg: any): void {
  // Minimal structural validation to avoid semantic drift.
  // NOTE: This is NOT a full schema validator, but it guards required anchors.
  if (!cfg || typeof cfg !== "object") throw new Error("Judge config must be an object");

  if (typeof cfg.schema_version !== "string") throw new Error("schema_version must be string");
  if (cfg.name != null && typeof cfg.name !== "string") throw new Error("name must be string when present");
  if (!Array.isArray(cfg.required_metrics) || cfg.required_metrics.some((x: any) => typeof x !== "string")) {
    throw new Error("required_metrics must be string[]");
  }
  if (!cfg.evidence || typeof cfg.evidence !== "object") throw new Error("evidence must be object");
  if (!cfg.marker || typeof cfg.marker !== "object") throw new Error("marker must be object");
  if (!Array.isArray(cfg.marker.exclusion_kinds) || cfg.marker.exclusion_kinds.some((x: any) => typeof x !== "string")) {
    throw new Error("marker.exclusion_kinds must be string[]");
  }
  if (!cfg.determinism || typeof cfg.determinism !== "object" || typeof cfg.determinism.tie_breaker !== "string") {
    throw new Error("determinism.tie_breaker must be string");
  }
}

export function getManifest(cfg: any): JudgeConfigManifestV1 {
  validateEffectiveConfig(cfg);

  const ssot_hash = computeSsotHash(cfg);
  const schema_version = String(cfg.schema_version);

  // Frozen V1 allowlist
  const editable: JudgeConfigEditableItem[] = [
    { path: "sufficiency.min_total_samples", type: "int", min: 1, max: 1000, description: "Stage-2 sufficiency threshold" },
    { path: "sufficiency.min_samples_per_required_metric", type: "int", min: 1, max: 1000, description: "Stage-2 sufficiency per-metric threshold" },

    { path: "time_coverage.max_allowed_gap_ms", type: "int", min: 0, max: 86400000, description: "Stage-3 maximum allowed gap" },
    { path: "time_coverage.min_coverage_ratio", type: "number", min: 0.0, max: 1.0, description: "Stage-3 minimum coverage ratio" },

    // Conditional allowlist (exists_in_ssot)
    { path: "time_coverage.expected_interval_ms", type: "int", min: 1000, max: 86400000, conditional: "exists_in_ssot", description: "Stage-3 expected sampling interval" },

    { path: "qc.bad_pct_threshold", type: "number", min: 0.0, max: 1.0, description: "Stage-4 QC bad percentage threshold" },
    { path: "qc.suspect_pct_threshold", type: "number", min: 0.0, max: 1.0, description: "Stage-4 QC suspect percentage threshold" },

    { path: "reference.enable", type: "bool", description: "Enable reference computation" },
    {
      path: "reference.kinds_enabled",
      type: "enum_list",
      enum: Array.isArray(cfg?.reference?.kinds_enabled) ? [...cfg.reference.kinds_enabled] : [],
      description: "Enabled reference kinds (subset-only)",
    },

    { path: "conflict.min_overlap_ratio", type: "number", min: 0.0, max: 1.0, description: "Stage-6 overlap ratio threshold" },
    { path: "conflict.delta_numeric_threshold", type: "number", min: 0.0, max: 1e9, description: "Stage-6 numeric delta threshold" },
    { path: "conflict.min_points_in_overlap", type: "int", min: 1, max: 100000, description: "Stage-6 minimum overlap points" },
  ];

  // Apply conditional exists_in_ssot gate: if not exists, remove from editable.
  const gatedEditable = editable.filter((it) => {
    if (it.conditional !== "exists_in_ssot") return true;
    return hasPath(cfg, it.path);
  });

  // defaults map is for UI display only.
  const defaults: Record<string, unknown> = {};
  for (const it of gatedEditable) {
    defaults[it.path] = getPath(cfg, it.path);
  }

  const read_only_hints = [
    "schema_version",
    "name",
    "required_metrics",
    "evidence",
    "marker.exclusion_kinds",
    "determinism",
    "determinism.tie_breaker",
  ];

  return {
    ssot: {
      source: "config/judge/default.json",
      schema_version,
      ssot_hash,
      updated_at_ts: nowMs(),
    },
    patch: {
      patch_version: "1.0.0",
      op_allowed: ["replace"],
      unknown_keys_policy: "reject",
    },
    editable: gatedEditable,
    defaults,
    read_only_hints,
  };
}
