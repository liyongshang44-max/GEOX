"use strict";
// GEOX/apps/judge/src/sim_config/patch.ts
//
// Simulator Config Patch (manifest-driven, replace-only).
//
// Contract:
// - replace-only ops
// - path must be in manifest.editable
// - unknown keys rejected
// - ssot_hash mismatch => 409 (handled by server)
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimConfigPatchRejected = void 0;
exports.computeEffectiveSimConfigHash = computeEffectiveSimConfigHash;
exports.validatePatchEnvelopeStrict = validatePatchEnvelopeStrict;
exports.validatePatchStrict = validatePatchStrict;
exports.applyPatch = applyPatch;
const util_1 = require("../util");
class SimConfigPatchRejected extends Error {
    constructor(status, errors) {
        super(errors.map((e) => `${e.code}:${e.path}`).join(","));
        this.name = "SimConfigPatchRejected";
        this.status = status;
        this.errors = errors;
    }
}
exports.SimConfigPatchRejected = SimConfigPatchRejected;
function isObj(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
}
function unknownKeys(obj, allow) {
    const s = new Set(allow);
    return Object.keys(obj).filter((k) => !s.has(k));
}
function computeEffectiveSimConfigHash(cfg) {
    return `sha256:${(0, util_1.sha256Hex)((0, util_1.stableStringify)(cfg))}`;
}
function validatePatchEnvelopeStrict(input) {
    // Expected shape:
    // { base: { ssot_hash }, patch: SimConfigPatchV1, dryRun?: boolean }
    const errors = [];
    if (!isObj(input)) {
        return [{ code: "INVALID_PATCH_SCHEMA", path: "", message: "body must be object" }];
    }
    const uk = unknownKeys(input, ["base", "patch", "dryRun"]);
    if (uk.length) {
        errors.push({ code: "UNKNOWN_KEYS", path: "", message: `unknown keys: ${uk.join(",")}` });
    }
    if (!isObj(input.base)) {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "base", message: "base must be object" });
    }
    else {
        const ukb = unknownKeys(input.base, ["ssot_hash"]);
        if (ukb.length) {
            errors.push({ code: "UNKNOWN_KEYS", path: "base", message: `unknown keys: ${ukb.join(",")}` });
        }
        if (typeof input.base.ssot_hash !== "string") {
            errors.push({ code: "INVALID_PATCH_SCHEMA", path: "base.ssot_hash", message: "ssot_hash must be string" });
        }
    }
    if (!isObj(input.patch)) {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch", message: "patch must be object" });
    }
    if (typeof input.dryRun !== "undefined" && typeof input.dryRun !== "boolean") {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "dryRun", message: "dryRun must be boolean" });
    }
    return errors;
}
function validateStringList(v) {
    if (!Array.isArray(v))
        return { ok: false, message: "value must be string[]" };
    const vals = [];
    for (const x of v) {
        if (typeof x !== "string")
            return { ok: false, message: "value must be string[]" };
        const t = x.trim();
        if (!t)
            continue;
        // Conservative: CAF files are like CAF009, CAF007, etc.
        if (!/^CAF\d{1,4}$/i.test(t))
            return { ok: false, message: `invalid location: ${t}` };
        vals.push(t.toUpperCase());
    }
    const uniq = Array.from(new Set(vals));
    if (!uniq.length)
        return { ok: false, message: "locations cannot be empty" };
    if (uniq.length > 50)
        return { ok: false, message: "too many locations (max 50)" };
    return { ok: true, values: uniq };
}
function validatePatchStrict(patch, manifest) {
    const errors = [];
    if (!isObj(patch)) {
        return [{ code: "INVALID_PATCH_SCHEMA", path: "patch", message: "patch must be object" }];
    }
    const uk = unknownKeys(patch, ["patch_version", "base", "ops"]);
    if (uk.length) {
        errors.push({ code: "UNKNOWN_KEYS", path: "patch", message: `unknown keys: ${uk.join(",")}` });
    }
    if (patch.patch_version !== "1.0.0") {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.patch_version", message: "patch_version must be 1.0.0" });
    }
    if (!isObj(patch.base)) {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.base", message: "base must be object" });
    }
    else {
        const ukb = unknownKeys(patch.base, ["ssot_hash"]);
        if (ukb.length) {
            errors.push({ code: "UNKNOWN_KEYS", path: "patch.base", message: `unknown keys: ${ukb.join(",")}` });
        }
        if (typeof patch.base.ssot_hash !== "string") {
            errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.base.ssot_hash", message: "ssot_hash must be string" });
        }
    }
    if (!Array.isArray(patch.ops)) {
        errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.ops", message: "ops must be array" });
        return errors;
    }
    const allowed = new Map();
    for (const it of manifest.editable)
        allowed.set(it.path, it);
    for (let i = 0; i < patch.ops.length; i++) {
        const op = patch.ops[i];
        const basePath = `patch.ops[${i}]`;
        if (!isObj(op)) {
            errors.push({ code: "INVALID_PATCH_SCHEMA", path: basePath, message: "op must be object" });
            continue;
        }
        const uko = unknownKeys(op, ["op", "path", "value"]);
        if (uko.length) {
            errors.push({ code: "UNKNOWN_KEYS", path: basePath, message: `unknown keys: ${uko.join(",")}` });
        }
        if (op.op !== "replace") {
            errors.push({ code: "INVALID_PATCH_SCHEMA", path: `${basePath}.op`, message: "op must be replace" });
        }
        if (typeof op.path !== "string" || op.path.trim() === "") {
            errors.push({ code: "INVALID_PATCH_SCHEMA", path: `${basePath}.path`, message: "path must be string" });
            continue;
        }
        const p = op.path.trim();
        const rule = allowed.get(p);
        if (!rule) {
            errors.push({ code: "PATH_NOT_ALLOWED", path: `${basePath}.path`, message: `path not allowed: ${p}` });
            continue;
        }
        const v = op.value;
        if (rule.type === "bool") {
            if (typeof v !== "boolean")
                errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be boolean" });
        }
        else if (rule.type === "int") {
            if (typeof v !== "number" || !Number.isInteger(v)) {
                errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be int" });
            }
            else {
                if (typeof rule.min === "number" && v < rule.min)
                    errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value below min", meta: { min: rule.min, max: rule.max } });
                if (typeof rule.max === "number" && v > rule.max)
                    errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value above max", meta: { min: rule.min, max: rule.max } });
            }
        }
        else if (rule.type === "number") {
            if (typeof v !== "number" || !Number.isFinite(v)) {
                errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be number" });
            }
            else {
                if (typeof rule.min === "number" && v < rule.min)
                    errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value below min", meta: { min: rule.min, max: rule.max } });
                if (typeof rule.max === "number" && v > rule.max)
                    errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value above max", meta: { min: rule.min, max: rule.max } });
            }
        }
        else if (rule.type === "string") {
            if (typeof v !== "string") {
                errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be string" });
            }
            else if (v.trim().length === 0) {
                errors.push({ code: "VALUE_INVALID", path: `${basePath}.value`, message: "value cannot be empty" });
            }
        }
        else if (rule.type === "string_list") {
            const res = validateStringList(v);
            if (!res.ok)
                errors.push({ code: "VALUE_INVALID", path: `${basePath}.value`, message: res.message });
        }
    }
    return errors;
}
function setPath(obj, dotPath, value) {
    const parts = dotPath.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur[p] || typeof cur[p] !== "object")
            cur[p] = {};
        cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
}
function applyPatch(cfg, patch) {
    // Pure replace-only application.
    const out = JSON.parse((0, util_1.stableStringify)(cfg));
    for (const op of patch.ops) {
        // Normalize locations list for determinism.
        if (op.path === "locations") {
            const res = validateStringList(op.value);
            if (res.ok) {
                setPath(out, op.path, res.values);
                continue;
            }
        }
        setPath(out, op.path, op.value);
    }
    return out;
}
