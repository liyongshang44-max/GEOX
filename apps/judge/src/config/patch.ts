// GEOX/apps/judge/src/config/patch.ts
//
// Judge Config Patch (Frozen Manifest v1).
//
// Contract:
// - replace-only ops
// - path must be in manifest.editable
// - unknown keys are rejected (static refusal)
// - ssot_hash mismatch is 409

import { sha256Hex, stableStringify } from "../util";
import type { JudgeConfigManifestV1, JudgeConfigEditableItem } from "./ssot";

export type JudgeConfigPatchOpV1 = {
  op: "replace";
  path: string;
  value: unknown;
};

export type JudgeConfigPatchV1 = {
  patch_version: "1.0.0";
  base: {
    ssot_hash: string;
  };
  ops: JudgeConfigPatchOpV1[];
};

export type PatchValidationError = {
  code:
    | "INVALID_PATCH_SCHEMA"
    | "UNKNOWN_KEYS"
    | "SSOT_HASH_MISMATCH"
    | "PATH_NOT_ALLOWED"
    | "VALUE_TYPE_MISMATCH"
    | "VALUE_OUT_OF_RANGE"
    | "VALUE_NOT_IN_ENUM"
    | "ENUM_NOT_SUBSET";
  path: string;
  message: string;
  meta?: Record<string, unknown>;
};

export class JudgeConfigPatchRejected extends Error {
  public readonly status: number;
  public readonly errors: PatchValidationError[];

  constructor(status: number, errors: PatchValidationError[]) {
    super(errors.map((e) => `${e.code}:${e.path}`).join(","));
    this.name = "JudgeConfigPatchRejected";
    this.status = status;
    this.errors = errors;
  }
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function unknownKeys(obj: Record<string, unknown>, allow: string[]): string[] {
  const s = new Set(allow);
  return Object.keys(obj).filter((k) => !s.has(k));
}

export function computeEffectiveConfigHash(cfg: any): string {
  return `sha256:${sha256Hex(stableStringify(cfg))}`;
}

export function validatePatchEnvelopeStrict(input: any): PatchValidationError[] {
  // This validates the wrapper used by POST /api/judge/config/patch.
  // Expected shape:
  // { base: { ssot_hash }, patch: JudgeConfigPatchV1, dryRun?: boolean }
  const errors: PatchValidationError[] = [];
  if (!isObj(input)) {
    return [{ code: "INVALID_PATCH_SCHEMA", path: "", message: "body must be object" }];
  }
  const uk = unknownKeys(input, ["base", "patch", "dryRun"]);
  if (uk.length) {
    errors.push({ code: "UNKNOWN_KEYS", path: "", message: `unknown keys: ${uk.join(",")}` });
  }
  if (!isObj((input as any).base)) {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "base", message: "base must be object" });
  } else {
    const ukb = unknownKeys((input as any).base, ["ssot_hash"]);
    if (ukb.length) {
      errors.push({ code: "UNKNOWN_KEYS", path: "base", message: `unknown keys: ${ukb.join(",")}` });
    }
    if (typeof (input as any).base.ssot_hash !== "string") {
      errors.push({ code: "INVALID_PATCH_SCHEMA", path: "base.ssot_hash", message: "ssot_hash must be string" });
    }
  }
  if (!isObj((input as any).patch)) {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch", message: "patch must be object" });
  }
  if (typeof (input as any).dryRun !== "undefined" && typeof (input as any).dryRun !== "boolean") {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "dryRun", message: "dryRun must be boolean" });
  }
  return errors;
}

export function validatePatchStrict(patch: any, manifest: JudgeConfigManifestV1): PatchValidationError[] {
  // Strict schema + allowlist validation.
  const errors: PatchValidationError[] = [];

  if (!isObj(patch)) {
    return [{ code: "INVALID_PATCH_SCHEMA", path: "patch", message: "patch must be object" }];
  }

  const uk = unknownKeys(patch, ["patch_version", "base", "ops"]);
  if (uk.length) {
    errors.push({ code: "UNKNOWN_KEYS", path: "patch", message: `unknown keys: ${uk.join(",")}` });
  }

  if ((patch as any).patch_version !== "1.0.0") {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.patch_version", message: "patch_version must be 1.0.0" });
  }

  if (!isObj((patch as any).base)) {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.base", message: "base must be object" });
  } else {
    const ukb = unknownKeys((patch as any).base, ["ssot_hash"]);
    if (ukb.length) {
      errors.push({ code: "UNKNOWN_KEYS", path: "patch.base", message: `unknown keys: ${ukb.join(",")}` });
    }
    if (typeof (patch as any).base.ssot_hash !== "string") {
      errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.base.ssot_hash", message: "ssot_hash must be string" });
    }
  }

  if (!Array.isArray((patch as any).ops)) {
    errors.push({ code: "INVALID_PATCH_SCHEMA", path: "patch.ops", message: "ops must be array" });
    return errors;
  }

  const allowed = new Map<string, JudgeConfigEditableItem>();
  for (const it of manifest.editable) allowed.set(it.path, it);

  for (let i = 0; i < (patch as any).ops.length; i++) {
    const op = (patch as any).ops[i];
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

    // Type / range / enum validation
    const v = op.value;
    if (rule.type === "bool") {
      if (typeof v !== "boolean") {
        errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be boolean" });
      }
    } else if (rule.type === "int") {
      if (typeof v !== "number" || !Number.isInteger(v)) {
        errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be int" });
      } else {
        if (typeof rule.min === "number" && v < rule.min) {
          errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value below min", meta: { min: rule.min, max: rule.max } });
        }
        if (typeof rule.max === "number" && v > rule.max) {
          errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value above max", meta: { min: rule.min, max: rule.max } });
        }
      }
    } else if (rule.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be number" });
      } else {
        if (typeof rule.min === "number" && v < rule.min) {
          errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value below min", meta: { min: rule.min, max: rule.max } });
        }
        if (typeof rule.max === "number" && v > rule.max) {
          errors.push({ code: "VALUE_OUT_OF_RANGE", path: `${basePath}.value`, message: "value above max", meta: { min: rule.min, max: rule.max } });
        }
      }
    } else if (rule.type === "enum_list") {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
        errors.push({ code: "VALUE_TYPE_MISMATCH", path: `${basePath}.value`, message: "value must be string[]" });
      } else {
        const enumSet = new Set((rule.enum ?? []).map(String));
        const uniq = Array.from(new Set(v.map(String)));
        const bad = uniq.filter((x) => !enumSet.has(x));
        if (bad.length) {
          errors.push({
            code: "ENUM_NOT_SUBSET",
            path: `${basePath}.value`,
            message: `value must be subset of enum; invalid: ${bad.join(",")}`,
            meta: { enum: Array.from(enumSet) },
          });
        }
      }
    }
  }

  return errors;
}

function setPath(obj: any, dotPath: string, value: any): void {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

export function applyPatch(cfg: any, patch: JudgeConfigPatchV1): any {
  // Pure replace-only application; caller must validate first.
  const out = JSON.parse(stableStringify(cfg));
  for (const op of patch.ops) {
    setPath(out, op.path, op.value);
  }
  return out;
}
