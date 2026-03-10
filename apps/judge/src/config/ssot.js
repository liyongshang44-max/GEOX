"use strict";
// GEOX/apps/judge/src/config/ssot.ts
//
// Judge Config SSOT / Manifest helpers (Frozen Manifest v1).
//
// Contract:
// - SSOT file: config/judge/default.json
// - ssot_hash: sha256(stableStringify(parsedJson)) with "sha256:" prefix
// - manifest is the only editable capability source for the frontend
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDefaultConfig = loadDefaultConfig;
exports.computeSsotHash = computeSsotHash;
exports.validateEffectiveConfig = validateEffectiveConfig;
exports.getManifest = getManifest;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const util_1 = require("../util");
function resolveRepoRoot() {
    // 1) explicit override (CI / dev convenience)
    if (process.env.GEOX_REPO_ROOT)
        return node_path_1.default.resolve(process.env.GEOX_REPO_ROOT);
    // 2) docker mount root in this repo is /app (container convention)
    const dockerRoot = "/app";
    if (node_fs_1.default.existsSync(node_path_1.default.join(dockerRoot, "config", "judge", "default.json")))
        return dockerRoot;
    // 3) local dev: walk upward from cwd until we find the SSOT file
    //    (prevents "apps/server" cwd from breaking SSOT resolution)
    return (0, util_1.findRepoRoot)(process.cwd(), "config/judge/default.json");
}
function readJsonFile(p) {
    const raw = node_fs_1.default.readFileSync(p, "utf8");
    return JSON.parse(raw);
}
function loadDefaultConfig() {
    const repoRoot = resolveRepoRoot();
    const p = node_path_1.default.join(repoRoot, "config", "judge", "default.json");
    return readJsonFile(p);
}
function computeSsotHash(cfg) {
    // canonical hash: stable stringify then sha256
    return `sha256:${(0, util_1.sha256Hex)((0, util_1.stableStringify)(cfg))}`;
}
function hasPath(obj, dotPath) {
    const parts = dotPath.split(".");
    let cur = obj;
    for (const p of parts) {
        if (!cur || typeof cur !== "object" || !(p in cur))
            return false;
        cur = cur[p];
    }
    return true;
}
function getPath(obj, dotPath) {
    const parts = dotPath.split(".");
    let cur = obj;
    for (const p of parts) {
        if (!cur || typeof cur !== "object")
            return undefined;
        cur = cur[p];
    }
    return cur;
}
function validateEffectiveConfig(cfg) {
    // Minimal structural validation to avoid semantic drift.
    // NOTE: This is NOT a full schema validator, but it guards required anchors.
    if (!cfg || typeof cfg !== "object")
        throw new Error("Judge config must be an object");
    if (typeof cfg.schema_version !== "string")
        throw new Error("schema_version must be string");
    if (cfg.name != null && typeof cfg.name !== "string")
        throw new Error("name must be string when present");
    if (!Array.isArray(cfg.required_metrics) || cfg.required_metrics.some((x) => typeof x !== "string")) {
        throw new Error("required_metrics must be string[]");
    }
    if (!cfg.evidence || typeof cfg.evidence !== "object")
        throw new Error("evidence must be object");
    if (!cfg.marker || typeof cfg.marker !== "object")
        throw new Error("marker must be object");
    if (!Array.isArray(cfg.marker.exclusion_kinds) || cfg.marker.exclusion_kinds.some((x) => typeof x !== "string")) {
        throw new Error("marker.exclusion_kinds must be string[]");
    }
    if (!cfg.determinism || typeof cfg.determinism !== "object" || typeof cfg.determinism.tie_breaker !== "string") {
        throw new Error("determinism.tie_breaker must be string");
    }
}
function getManifest(cfg) {
    validateEffectiveConfig(cfg);
    const ssot_hash = computeSsotHash(cfg);
    const schema_version = String(cfg.schema_version);
    // Frozen V1 allowlist
    const editable = [
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
        if (it.conditional !== "exists_in_ssot")
            return true;
        return hasPath(cfg, it.path);
    });
    // defaults map is for UI display only.
    const defaults = {};
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
            updated_at_ts: (0, util_1.nowMs)(),
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
