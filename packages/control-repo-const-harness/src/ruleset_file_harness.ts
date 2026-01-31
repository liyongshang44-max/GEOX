import fs from "node:fs"; // Harness-only file IO for repo-const ruleset assets.
import crypto from "node:crypto"; // Deterministic hashing for offline-recomputable ruleset_ref.

import type { ControlVerdictV0 } from "@geox/contracts"; // ControlVerdict v0 TS type (auditable output shape).
import { parseControlVerdictV0 } from "@geox/contracts"; // Runtime parse to enforce output contract.

import type { ControlRuleSetV0 } from "@geox/control-kernel"; // RuleSet v0 TS type: kernel is the consumer SSOT.
import { isControlRuleSetV0, validateControlRuleSetV0 } from "@geox/control-constitution-validator"; // Admission validator.

import { evaluateControlV0 } from "@geox/control-kernel"; // Pure evaluation kernel (no IO; no runtime loading).

export type RulesetStatusV0 = "APPLIED" | "MISSING" | "INVALID"; // Ruleset application status (audit-only anchor).

export type RulesetLoadResultV0 =
  | { status: "APPLIED"; ruleset_ref: string; ruleset: ControlRuleSetV0 }
  | { status: "MISSING"; ruleset_ref: "MISSING" }
  | { status: "INVALID"; ruleset_ref: string; error_code: string };

 function normalizeRuleRefToString(ruleRef: unknown): string | undefined {
  // Contracts expect rule_ref as string. Kernel may return structured object.
  if (ruleRef === undefined || ruleRef === null) return undefined;

  if (typeof ruleRef === "string") return ruleRef;

  if (typeof ruleRef === "object") {
    const rr: any = ruleRef;
    const rulesetId = typeof rr.ruleset_id === "string" ? rr.ruleset_id : undefined;
    const ruleId = typeof rr.rule_id === "string" ? rr.rule_id : undefined;
    const ruleVer = typeof rr.rule_version === "string" ? rr.rule_version : undefined;

    if (rulesetId && ruleId && ruleVer) {
      // Deterministic, offline-recomputable anchor.
      return `repo-const-v0:${rulesetId}/${ruleId}@${ruleVer}`;
    }
  }

  // Fall back: preserve determinism without embedding JSON semantics into contracts.
  return "repo-const-v0:UNPARSEABLE_RULE_REF";
}
 

function sha256Hex(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex"); // Deterministic digest; offline recomputable.
}

function rulesetRefFromBytes(bytes: Buffer): string {
  return `sha256:${sha256Hex(bytes)}`; // Ruleset ref: stable, offline recomputable.
}

function zodErrorToCode(e: unknown): string {
  // Convert validation error into a machine-readable (non-text) code.
  // Kept coarse to avoid "explanation semantics" in outputs.
  if (typeof e === "object" && e !== null && "issues" in e) return "RULESET_ZOD_INVALID";
  return "RULESET_ADMISSION_INVALID";
}

export function loadRulesetFromFile(filePath: string): RulesetLoadResultV0 {
  // Loading is explicit: caller must pass the exact path.
  // NO directory scanning, NO discovery, NO defaults.
  if (!fs.existsSync(filePath)) {
    return { status: "MISSING", ruleset_ref: "MISSING" }; // Missing is deterministic.
  }

  const bytes = fs.readFileSync(filePath); // Exact bytes for deterministic ref.
  const ruleset_ref = rulesetRefFromBytes(bytes);

  try {
    const json = JSON.parse(bytes.toString("utf8")); // Parse JSON object.
    const admitted = validateControlRuleSetV0(json) as any; // Admission 杈撳嚭锛歷alidator 鐨?ruleset 褰㈡€侊紙rules[].expr锛夈€?
// harness-only锛氶伩鍏嶆妸鈥滄ˉ鎺ヨ涔夆€濇笚閫忓埌 runtime 绫诲瀷绯荤粺閲屻€?
return {
  status: "APPLIED",
  ruleset_ref,
  ruleset: ({
    ...admitted,
    rules: (admitted.rules ?? []).map((r: any) => ({
      ...r,
      template: (r.template ?? r.expr),
    })),
  } as any),
}; // APPLIED锛氳繑鍥?kernel 褰㈡€?ruleset 渚?evaluate 浣跨敤銆?
  } catch (e) {
    return { status: "INVALID", ruleset_ref, error_code: zodErrorToCode(e) };
  }
}

export type EvaluateHarnessInputV0 = {
  subjectRef: { projectId?: string; groupId?: string; plotId?: string; blockId?: string }; // Subject reference (opaque).
  window: { startTs: number; endTs: number }; // Time window (opaque).
  action_code: string; // Target action code (AO taxonomy).

  // NOTE: Kernel signature is (problemState, uncertaintyEnvelope, permissionSet, ruleSets).
  // Harness provides these three inputs explicitly; NOT read from system.
  problemState: Record<string, unknown>; // Must include subjectRef + window for kernel output shaping.
  uncertaintyEnvelope: Record<string, unknown>; // Minimal envelope object (can be empty but must satisfy projector).
  permissionSet: Record<string, unknown>; // Minimal permission set object (can be empty but must satisfy projector).
};

export type EvaluateHarnessResultV0 = {
  verdict: ControlVerdictV0; // control_verdict_v0 output.
  ruleset_status: RulesetStatusV0; // Convenience mirror; equals verdict.ruleset_status.
};

export function evaluateControlFromRepoConstFileV0(
  filePath: string,
  input: EvaluateHarnessInputV0
): EvaluateHarnessResultV0 {
  const loaded = loadRulesetFromFile(filePath);

  // Kernel must not have any "ruleset missing" branch.
  // Harness maps missing/invalid => evaluate with empty rulesets (or skip eval) and emits UNDETERMINED.
  if (loaded.status === "APPLIED") {
    // Ensure kernel can emit subject/window from problemState (opaque; not interpreted).
    const ps: any = {
      ...input.problemState,
      subjectRef: input.subjectRef,
      window: input.window
    };

    const verdicts = evaluateControlV0(
      ps,
      input.uncertaintyEnvelope as any,
      input.permissionSet as any,
      [loaded.ruleset as any]
    ) as any[];

    // v0 harness expects exactly one ruleset => one verdict.
    const kernelVerdict: any = verdicts[0];

// Normalize rule_ref to satisfy contracts (string-only).
const normalizedRuleRef = normalizeRuleRefToString(kernelVerdict.rule_ref);

const merged: any = {
  ...kernelVerdict,
  rule_ref: normalizedRuleRef, // overwrite if present
  ruleset_ref: loaded.ruleset_ref,
  ruleset_status: "APPLIED" as const
};

    return { verdict: parseControlVerdictV0(merged), ruleset_status: "APPLIED" };
  }

  // Missing/Invalid ruleset => UNDETERMINED + ruleset_status anchor (audit-only).
  const synthetic: any = {
    type: "control_verdict_v0",
    schema_version: "0.1.0",
    verdict_id: crypto.randomUUID(),
    evaluated_at_ts: Date.now(),
    subjectRef: input.subjectRef,
    window: input.window,
    action_code: input.action_code,
    verdict: "UNDETERMINED",
    ruleset_ref: loaded.ruleset_ref,
    ruleset_status: loaded.status
  };

  return {
    verdict: parseControlVerdictV0(synthetic),
    ruleset_status: loaded.status
  };
}

export function isRulesetJsonFileV0(filePath: string): boolean {
  // Helper: used ONLY in harness/test contexts.
  // Intentionally shallow: does not validate semantics.
  if (!fs.existsSync(filePath)) return false;
  try {
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isControlRuleSetV0(json);
  } catch {
    return false;
  }
}





