"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowMs = nowMs;
exports.newId = newId;
exports.newRunId = newRunId;
exports.stableStringify = stableStringify;
exports.sha256Hex = sha256Hex;
exports.assertString = assertString;
exports.assertInt = assertInt;
exports.clamp01 = clamp01;
exports.findRepoRoot = findRepoRoot;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function nowMs() {
    return Date.now();
}
function newId(prefix) {
    // deterministic IDs are not required; run_id uniqueness is required.
    return `${prefix}_${(0, node_crypto_1.randomUUID)().replace(/-/g, "").slice(0, 24)}`;
}
function newRunId() {
    return (0, node_crypto_1.randomUUID)();
}
function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
}
function sha256Hex(s) {
    return (0, node_crypto_1.createHash)("sha256").update(s).digest("hex");
}
function canonicalize(x) {
    if (x === null || x === undefined)
        return x;
    if (Array.isArray(x)) {
        return x.map(canonicalize);
    }
    if (typeof x === "object") {
        const out = {};
        const keys = Object.keys(x).sort();
        for (const k of keys)
            out[k] = canonicalize(x[k]);
        return out;
    }
    return x;
}
function assertString(v, name) {
    if (typeof v !== "string" || v.trim().length === 0)
        throw new Error(`invalid ${name}`);
    return v.trim();
}
function assertInt(v, name) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n) || !Number.isInteger(n))
        throw new Error(`invalid ${name}`);
    return n;
}
function clamp01(x) {
    if (!Number.isFinite(x))
        return 0;
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
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
function findRepoRoot(startDir, requiredRelativePath, maxHops = 8) {
    // Normalize to an absolute directory path.
    let cur = node_path_1.default.resolve(startDir);
    for (let hop = 0; hop <= maxHops; hop++) {
        const probe = node_path_1.default.join(cur, requiredRelativePath);
        if (node_fs_1.default.existsSync(probe))
            return cur;
        const parent = node_path_1.default.dirname(cur);
        if (parent === cur)
            break; // reached filesystem root
        cur = parent;
    }
    throw new Error(`Cannot locate repo root from ${startDir}; missing ${requiredRelativePath}`);
}
