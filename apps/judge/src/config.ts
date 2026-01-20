import fs from "node:fs";
import path from "node:path";
import { assertString } from "./util";

export type JudgeConfigV1 = {
  schema_version: string;
  required_metrics: string[];
  sufficiency: { min_total_samples: number; min_samples_per_required_metric: number };
  time_coverage: { max_allowed_gap_ms: number; min_coverage_ratio: number };
  qc: { bad_pct_threshold: number; suspect_pct_threshold: number };
  marker: { exclusion_kinds: string[] };
  reference: { enable: boolean; kinds_enabled: string[] };
  conflict: { min_overlap_ratio: number; delta_numeric_threshold: number; min_points_in_overlap: number };
  determinism: { tie_breaker: string };
};

function resolveRepoRoot(): string {
  // docker mount root in this repo is /app (confirmed by your ls/pwd)
  if (process.env.GEOX_REPO_ROOT) return path.resolve(process.env.GEOX_REPO_ROOT);

  // Prefer /app when it exists (works even if process.cwd() is /app/apps/server)
  const dockerRoot = "/app";
  if (fs.existsSync(path.join(dockerRoot, "config", "judge"))) return dockerRoot;

  // Fallback: cwd (local dev usually repo root)
  return path.resolve(process.cwd());
}

export function loadJudgeConfig(profile: string): JudgeConfigV1 {
  const name = assertString(profile, "config_profile");
  const repoRoot = resolveRepoRoot();
  const p = path.join(repoRoot, "config", "judge", `${name}.json`);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as JudgeConfigV1;
}