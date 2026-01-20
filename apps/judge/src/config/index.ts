// GEOX/apps/judge/src/config/index.ts
// SSOT minimal loader + validator for Judge config.
//
// Source of truth:
//   GEOX/config/judge/ruleset_v1.json
//
// Pipeline imports:
//   import { loadJudgeConfig } from "./config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type JudgeConfigV1 = {
  schema_version: string;

  required_metrics: string[];

  sufficiency: {
    min_total_samples: number;
    min_samples_per_required_metric: number;
  };

  time_coverage: {
    max_allowed_gap_ms: number;
    min_coverage_ratio: number;
  };

  qc: {
    bad_pct_threshold: number;
    suspect_pct_threshold: number;
  };

  marker: {
    exclusion_kinds: string[];
  };

  reference: {
    enable: boolean;
    kinds_enabled: string[];
  };

  conflict: {
    min_overlap_ratio: number;
    delta_numeric_threshold: number;
    min_points_in_overlap: number;
  };

  determinism: {
    tie_breaker: string;
  };
};

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isStr(x: unknown): x is string {
  return typeof x === "string";
}
function isStrArr(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

export function validateJudgeConfigV1(cfg: unknown): asserts cfg is JudgeConfigV1 {
  if (!isObj(cfg)) throw new Error("Judge config must be an object");

  if (!isStr(cfg.schema_version)) throw new Error("schema_version must be a string");
  if (!isStrArr(cfg.required_metrics) || cfg.required_metrics.length === 0) {
    throw new Error("required_metrics must be a non-empty string[]");
  }

  const s = (cfg as any).sufficiency;
  if (!isObj(s) || !isNum(s.min_total_samples) || !isNum(s.min_samples_per_required_metric)) {
    throw new Error("sufficiency.* must be numbers");
  }

  const tc = (cfg as any).time_coverage;
  if (!isObj(tc) || !isNum(tc.max_allowed_gap_ms) || !isNum(tc.min_coverage_ratio)) {
    throw new Error("time_coverage.* must be numbers");
  }

  const qc = (cfg as any).qc;
  if (!isObj(qc) || !isNum(qc.bad_pct_threshold) || !isNum(qc.suspect_pct_threshold)) {
    throw new Error("qc.* must be numbers");
  }

  const mk = (cfg as any).marker;
  if (!isObj(mk) || !isStrArr(mk.exclusion_kinds)) {
    throw new Error("marker.exclusion_kinds must be string[]");
  }

  const ref = (cfg as any).reference;
  if (!isObj(ref) || typeof ref.enable !== "boolean" || !isStrArr(ref.kinds_enabled)) {
    throw new Error("reference.enable must be boolean and reference.kinds_enabled must be string[]");
  }

  const cf = (cfg as any).conflict;
  if (!isObj(cf) || !isNum(cf.min_overlap_ratio) || !isNum(cf.delta_numeric_threshold) || !isNum(cf.min_points_in_overlap)) {
    throw new Error("conflict.* must be numbers");
  }

  const det = (cfg as any).determinism;
  if (!isObj(det) || !isStr(det.tie_breaker)) {
    throw new Error("determinism.tie_breaker must be a string");
  }
}

function resolveRepoRoot(): string {
  // This file lives at: GEOX/apps/judge/src/config/index.ts
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../../../..");
}

export function loadJudgeConfig(config_profile: string = "default"): JudgeConfigV1 {
  // Minimal: config_profile is ignored for now; ruleset_v1.json is the SSOT.
  // (You can extend later: ruleset_${profile}.json, etc.)
  const repoRoot = resolveRepoRoot();
  const rulesetPath = path.join(repoRoot, "config", "judge", "ruleset_v1.json");

  const raw = fs.readFileSync(rulesetPath, "utf8");
  const cfg = JSON.parse(raw);

  validateJudgeConfigV1(cfg);

  // Optional: keep deterministic ordering where it matters
  cfg.required_metrics = [...cfg.required_metrics].sort();
  cfg.marker.exclusion_kinds = [...cfg.marker.exclusion_kinds].sort();
  cfg.reference.kinds_enabled = [...cfg.reference.kinds_enabled].sort();

  return cfg;
}
