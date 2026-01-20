// GEOX/apps/judge/src/sim_config/ssot.ts
//
// Simulator Config SSOT / Manifest helpers.
//
// Contract:
// - SSOT file: config/sim/default.json
// - ssot_hash: sha256(stableStringify(parsedJson)) with "sha256:" prefix
// - manifest is the only editable capability source for the frontend

import fs from "node:fs";
import path from "node:path";

import { findRepoRoot, nowMs, sha256Hex, stableStringify } from "../util";

export type SimManifestValueType = "int" | "number" | "bool" | "string" | "string_list";

export type SimConfigEditableItem = {
  // Full dot path (e.g. "speed")
  path: string;

  // Input type for UI + validator
  type: SimManifestValueType;

  // Numeric constraints (only for int/number)
  min?: number;
  max?: number;

  // Optional conditional gate
  // - exists_in_ssot: only editable if the path exists in default.json
  conditional?: "exists_in_ssot";

  // Human readable hint for UI (non-semantic)
  description?: string;
};

export type SimConfigManifestV1 = {
  ssot: {
    source: "config/sim/default.json";
    schema_version: string;
    ssot_hash: string;
    updated_at_ts: number;
  };
  patch: {
    patch_version: "1.0.0";
    op_allowed: ["replace"];
    unknown_keys_policy: "reject";
  };
  editable: SimConfigEditableItem[];
  defaults: Record<string, unknown>;
  read_only_hints: string[];
};

function resolveRepoRoot(): string {
  // 1) explicit override
  if (process.env.GEOX_REPO_ROOT) return path.resolve(process.env.GEOX_REPO_ROOT);

  // 2) docker mount root in this repo is /app (when present)
  const dockerRoot = "/app";
  if (fs.existsSync(path.join(dockerRoot, "config", "sim", "default.json"))) return dockerRoot;

  // 3) local dev: walk upward until we can see config/sim/default.json
  const found = findRepoRoot(process.cwd(), path.join("config", "sim", "default.json"));
  return path.resolve(found);
}

function readJsonFile(p: string): any {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

export function loadDefaultSimConfig(): any {
  const repoRoot = resolveRepoRoot();
  const p = path.join(repoRoot, "config", "sim", "default.json");
  return readJsonFile(p);
}

export function computeSimSsotHash(cfg: any): string {
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

export function validateEffectiveSimConfig(cfg: any): void {
  if (!cfg || typeof cfg !== "object") throw new Error("Sim config must be an object");

  if (typeof cfg.schema_version !== "string") throw new Error("schema_version must be string");
  if (cfg.name != null && typeof cfg.name !== "string") throw new Error("name must be string when present");

  // Required execution anchors (script depends on these keys)
  // NOTE: Route A import mode allows datasetDir/locations to be empty.
  if (cfg.datasetDir != null && typeof cfg.datasetDir !== "string") throw new Error("datasetDir must be string when present");
  if (cfg.locations != null) {
    if (!Array.isArray(cfg.locations) || cfg.locations.some((x: any) => typeof x !== "string")) {
      throw new Error("locations must be string[] when present");
    }
  }
  if (typeof cfg.projectId !== "string") throw new Error("projectId must be string");
  if (typeof cfg.groupId !== "string") throw new Error("groupId must be string");
  if (typeof cfg.window_days !== "number" || !Number.isFinite(cfg.window_days)) throw new Error("window_days must be number");
  if (typeof cfg.speed !== "number" || !Number.isFinite(cfg.speed)) throw new Error("speed must be number");
  if (typeof cfg.once !== "boolean") throw new Error("once must be boolean");
  if (typeof cfg.dry_run !== "boolean") throw new Error("dry_run must be boolean");

  // Import-mode options (Route A). All are optional but must type-check if present.
  if (cfg.mode != null && typeof cfg.mode !== "string") throw new Error("mode must be string when present");
  if (cfg.import != null) {
    if (!cfg.import || typeof cfg.import !== "object") throw new Error("import must be object when present");
    if (cfg.import.import_file != null && typeof cfg.import.import_file !== "string") throw new Error("import.import_file must be string when present");
    if (cfg.import.write_raw_samples != null && typeof cfg.import.write_raw_samples !== "boolean") throw new Error("import.write_raw_samples must be boolean when present");
    if (cfg.import.write_markers != null && typeof cfg.import.write_markers !== "boolean") throw new Error("import.write_markers must be boolean when present");
    if (cfg.import.source != null && typeof cfg.import.source !== "string") throw new Error("import.source must be string when present");
  }
}

export function getSimManifest(cfg: any): SimConfigManifestV1 {
  validateEffectiveSimConfig(cfg);

  const ssot_hash = computeSimSsotHash(cfg);
  const schema_version = String(cfg.schema_version);

  // Frozen V1 allowlist for simulator execution parameters.
  // Note: this is NOT Judge semantics; it only controls the ingestion simulator.
  const editable: SimConfigEditableItem[] = [
    { path: "mode", type: "string", description: "运行模式：stream(映射到 now) / import(按文件时间戳写入)" },

    { path: "datasetDir", type: "string", description: "CAF 数据集根目录（包含 caf_sensors/Hourly 与 QC/Flags）" },
    { path: "locations", type: "string_list", description: "传感器列表（如 CAF009, CAF007）" },

    { path: "import.import_file", type: "string", description: "Route A: 直接导入单个 CAF*.txt 文件（tab 分隔）" },
    { path: "import.write_raw_samples", type: "bool", description: "导入时是否写 raw_samples 投影表" },
    { path: "import.write_markers", type: "bool", description: "导入时是否对 NA 写 marker_v1 + markers" },
    { path: "import.source", type: "string", description: "facts.source / payload.source（import/sim 等）" },

    { path: "projectId", type: "string", description: "写入 facts.entity.project_id" },
    { path: "groupId", type: "string", description: "写入 facts.entity.group_id" },

    { path: "window_days", type: "int", min: 1, max: 30, description: "映射到 now 的历史窗口天数" },
    { path: "speed", type: "int", min: 1, max: 600, description: "倍速（60=每秒约1分钟数据）" },
    { path: "once", type: "bool", description: "一次性回填窗口（true）或持续实时流（false）" },
    { path: "dry_run", type: "bool", description: "只打印不写库" },
  ];

  // defaults map is for UI display only.
  const defaults: Record<string, unknown> = {};
  for (const it of editable) {
    if (it.conditional === "exists_in_ssot" && !hasPath(cfg, it.path)) continue;
    defaults[it.path] = getPath(cfg, it.path);
  }

  const read_only_hints = ["schema_version", "name"]; // SSOT anchors (not editable)

  return {
    ssot: {
      source: "config/sim/default.json",
      schema_version,
      ssot_hash,
      updated_at_ts: nowMs(),
    },
    patch: {
      patch_version: "1.0.0",
      op_allowed: ["replace"],
      unknown_keys_policy: "reject",
    },
    editable,
    defaults,
    read_only_hints,
  };
}
