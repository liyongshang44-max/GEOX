// apps/judge/src/pipeline.ts

import type { AppleIReader } from "./applei_reader";
import { loadDefaultConfig, computeSsotHash, getManifest, validateEffectiveConfig } from "./config/ssot";
import type { JudgeConfigPatchV1 } from "./config/patch";
import { applyPatch as applyConfigPatch, computeEffectiveConfigHash, validatePatchStrict, JudgeConfigPatchRejected } from "./config/patch";
import { sha256Hex, stableStringify } from "./util";
import { splitEvidence } from "./evidence";
import { checkSufficiency } from "./rules/stage2_sufficiency";
import { computeTimeCoverage } from "./rules/stage3_time_coverage";
import { evaluateQC } from "./rules/stage4_qc";
import { detectEvidenceConflict, detectReferenceConflict } from "./rules/stage6_conflict";
import { checkMarkers } from "./rules/stage8_marker";
import { buildHistoryReference, type ReferenceViewV1 } from "./reference/reference_builder";
import { makeProblemStateBase, type ProblemStateV1, type EvidenceRef } from "./problem_state";
import { deriveAoSense, type AoSenseV1 } from "./ao_sense";
import { deriveLBCandidates, type LBCandidateV1 } from "./lb_candidate";

export type JudgeRunInput = {
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  options?: {
    persist?: boolean;
    include_reference_views?: boolean;
    include_lb_candidates?: boolean;
    config_profile?: string;
    // Inline patch (Frozen Manifest v1). Frontend must NOT create new rules.
    config_patch?: JudgeConfigPatchV1;
  };
};

export type JudgeRunOutput = {
  determinism_hash: string;
  // Canonical hash of the effective config (default.json + validated patch applied)
  effective_config_hash: string;
  problem_states: ProblemStateV1[];
  ao_sense: AoSenseV1[];
  reference_views?: ReferenceViewV1[];
  lb_candidates?: LBCandidateV1[];
  silent: boolean;
  run_meta: { pipeline_version: "judge_pipeline_v1"; config_profile: string };
  input_fact_ids: string[];
};

export type JudgePipelineRun = {
  input_bundle: any;
  output: JudgeRunOutput;
  produced_reference_views: ReferenceViewV1[];
  produced_lb_candidates: LBCandidateV1[];
};

export class JudgePipelineV1 {
  constructor(private reader: AppleIReader) {}

  private hashBundle(args: {
    subjectRef: any;
    scale: string;
    window: { startTs: number; endTs: number };
    config_profile: string;
    ssot_hash: string;
    effective_config_hash: string;
    factIds: string[];
    reference_view_ids: string[];
  }) {
    const input_bundle = {
      subjectRef: args.subjectRef,
      scale: args.scale,
      window: args.window,
      pipeline_version: "judge_pipeline_v1",
      config_profile: args.config_profile,
      ssot_hash: args.ssot_hash,
      effective_config_hash: args.effective_config_hash,
      factIds: [...args.factIds],
      reference_view_ids: [...args.reference_view_ids],
    };
    return { input_bundle, determinism_hash: sha256Hex(stableStringify(input_bundle)) };
  }

  private makeLedgerSliceRef(factIds: string[], window: { startTs: number; endTs: number }): EvidenceRef | null {
    if (!factIds.length) return null;
    return {
      kind: "ledger_slice",
      ref_id: `ls_${sha256Hex(stableStringify(factIds)).slice(0, 24)}`,
      note: "canonical slice of input facts (deterministic)",
      time_range: { ...window },
    };
  }

  private makeQCSummaryRef(qc: any, window: { startTs: number; endTs: number }): EvidenceRef {
    return {
      kind: "qc_summary",
      ref_id: `qc_${sha256Hex(stableStringify(qc)).slice(0, 24)}`,
      note: "canonical qc summary (deterministic)",
      time_range: { ...window },
    };
  }

  private async buildReferenceViews(args: {
    cfg: any;
    subjectRef: any;
    scale: string;
    window: { startTs: number; endTs: number };
    samples: any[];
  }): Promise<ReferenceViewV1[]> {
    if (!args.cfg.reference?.enable) return [];

    // Only build kinds that are enabled by configuration (AII-04 §3.4/§3.5).
    const kinds = Array.isArray(args.cfg.reference?.kinds_enabled) ? args.cfg.reference.kinds_enabled : [];
    if (!kinds.includes("WITHIN_UNIT_HISTORY")) return [];

    // Deterministic history window: immediately preceding window of same duration.
    const dur = Math.max(1, args.window.endTs - args.window.startTs);
    const historyWindow = { startTs: args.window.startTs - dur, endTs: args.window.startTs };

    const historyRows = await this.reader.queryWindow({
      startTsMs: historyWindow.startTs,
      endTsMs: historyWindow.endTs,
      groupId: typeof args.subjectRef?.groupId === "string" ? args.subjectRef.groupId : undefined,
      spatialUnitId: typeof args.subjectRef?.spatialUnitId === "string" ? args.subjectRef.spatialUnitId : undefined,
      metrics: args.cfg.required_metrics,
    });
    const { samples: historySamples } = splitEvidence(historyRows);

    const out: ReferenceViewV1[] = [];
    for (const metric of args.cfg.required_metrics) {
      const rv = buildHistoryReference({
        cfg: args.cfg,
        subjectRef: args.subjectRef,
        scale: args.scale,
        window: args.window,
        metric,
        primarySamples: args.samples,
        referenceSamples: historySamples,
      });
      out.push(rv);
    }
    return out;
  }

  async run(run_id: string, input: JudgeRunInput): Promise<JudgePipelineRun> {
    const config_profile = input.options?.config_profile ?? "default";
    // SSOT is fixed to config/judge/default.json.
    const ssotCfg = loadDefaultConfig();
    const ssot_hash = computeSsotHash(ssotCfg);

    // Optional inline patch (replace-only). Must be validated statically.
    const patch = input.options?.config_patch;
    let cfg: any = ssotCfg;
    if (patch) {
      // Step-2: ssot_hash match (409)
      if (patch?.base?.ssot_hash !== ssot_hash) {
        throw new JudgeConfigPatchRejected(409, [
          {
            code: "SSOT_HASH_MISMATCH",
            path: "patch.base.ssot_hash",
            message: `ssot_hash mismatch: got=${String(patch?.base?.ssot_hash ?? "")} expected=${ssot_hash}`,
          },
        ]);
      }
      // Step-3: ops validation (allowlist/type/range/enum)
      const manifest = getManifest(ssotCfg);
      const errors = validatePatchStrict(patch, manifest);
      if (errors.length) throw new JudgeConfigPatchRejected(400, errors);
      // Step-4: apply patch (pure replace)
      cfg = applyConfigPatch(ssotCfg, patch);
      // Step-5: validate effective config structure
      validateEffectiveConfig(cfg);
    }

    const effective_config_hash = computeEffectiveConfigHash(cfg);

    const subjectRef = input.subjectRef;
    const scale = input.scale;
    const window = input.window;

    // ─────────────────────────────────────────────
    // Stage-1: Input Assembly (deterministic)
    // ─────────────────────────────────────────────
    const rows = await this.reader.queryWindow({
      startTsMs: window.startTs,
      endTsMs: window.endTs,
      groupId: typeof subjectRef?.groupId === "string" ? subjectRef.groupId : undefined,
      spatialUnitId: typeof subjectRef?.spatialUnitId === "string" ? subjectRef.spatialUnitId : undefined,
      metrics: cfg.required_metrics,
    });
    const { samples, markers, factIds } = splitEvidence(rows);
    const ledgerRef = this.makeLedgerSliceRef(factIds, window);

    // ✅ Deterministic rollups for ProblemState fields.
    //    These must be defined in the function scope (NOT inside a conditional block),
    //    because later stages (Scale Policy / Marker Exclusion / etc.) use them.
    //    Keep extraction conservative and stable: de-dup + sort.
    const sensors_involved: string[] = Array.from(
      new Set(
        (samples ?? [])
          .map((s: any) => (typeof s?.sensorId === "string" ? s.sensorId : s?.sensor_id))
          .filter((x: any) => typeof x === "string" && x)
      )
    ).sort();

    const metrics_involved: string[] = Array.from(
      new Set((samples ?? []).map((s: any) => s?.metric).filter((x: any) => typeof x === "string" && x))
    ).sort();

    // Stage-2: Sufficiency
    const suff = checkSufficiency(cfg, samples);
    if (!suff.ok) {
      const supporting: EvidenceRef[] = [];
      const qc0 = evaluateQC(cfg, samples);
      if (qc0) supporting.push(this.makeQCSummaryRef(qc0, window));
      if (ledgerRef) supporting.push(ledgerRef);

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: "INSUFFICIENT_EVIDENCE",
        confidence: suff.confidence,
        uncertainty_sources: suff.uncertainty_sources,
        summary: suff.summary,
        metrics_involved: suff.metrics_involved,
        sensors_involved: suff.sensors_involved,
        supporting_evidence_refs: supporting.length ? supporting : undefined,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: suff.problem_scope,
      });

      const produced_reference_views: ReferenceViewV1[] = [];
      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: [],
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? [] : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    // Stage-3: Time Coverage
    // NOTE: pass markers so time-axis exclusions (maintenance/offline windows) can be applied.
    const tc = computeTimeCoverage(cfg, window, samples, markers);
if (!tc.ok) {
  const duration = Math.max(1, window.endTs - window.startTs);
  const ts = samples.map((s) => s.ts).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  const n = ts.length;

  // Window edge-effect rule must be deterministic and config-driven.
  const edgeThreshold =
    typeof cfg.time_coverage?.min_coverage_ratio === "number"
      ? 1 - cfg.time_coverage.min_coverage_ratio
      : null;

  const tailOnly =
    n <= 1 ||
    (edgeThreshold != null && (ts[0] - window.startTs) / duration > edgeThreshold) ||
    (edgeThreshold != null && (window.endTs - ts[n - 1]) / duration > edgeThreshold);

  const problem_type = tailOnly ? "WINDOW_NOT_SUPPORT" : "TIME_COVERAGE_GAPPY";

  // ---- NEW: confidence mapping based on density (commercially stable) ----
  const confidence: "LOW" | "MEDIUM" =
    tc.coverageRatio >= 0.5 ? "MEDIUM" : "LOW";

  const qc0 = evaluateQC(cfg, samples);
  const supporting: EvidenceRef[] = [];

  if (qc0) supporting.push(this.makeQCSummaryRef(qc0, window));
  if (ledgerRef) supporting.push(ledgerRef);

  // ---- NEW: attach maxGapMs as structured supporting evidence ----
  supporting.push({
    kind: "state_vector",
    ref_id: `time_gap_${tc.maxGapMs}`,
    note: `max_gap_ms=${tc.maxGapMs}, expected_interval_ms=${tc.expectedIntervalMs}`,
    time_range: { startTs: window.startTs, endTs: window.endTs },
  });

  const pct = (tc.coverageRatio * 100).toFixed(1);

  // ✅ Reuse function-scope rollups (deterministic) to avoid scope bugs.
  //    NOTE: kept as variables (not re-declared) so later stages can also use them.

  // Rate class hint derived from expected interval (ms). Boundaries are conservative.
  const rate_class_hint: ProblemStateV1["rate_class_hint"] =
    tc.expectedIntervalMs <= 5_000 ? "fast" : tc.expectedIntervalMs <= 300_000 ? "mid" : "slow";

  const ps = makeProblemStateBase({
    subjectRef,
    scale,
    window,
    problem_type,
    confidence,
    uncertainty_sources: ["SAMPLING_DENSITY"],
    summary: `Insufficient sampling density in window: ${pct}% of expected samples (expected_interval_ms=${tc.expectedIntervalMs})`,
    metrics_involved,
    sensors_involved,
    supporting_evidence_refs: supporting.length ? supporting : undefined,
    system_degraded: true,
    state_layer_hint: "unknown",
    rate_class_hint,
    problem_scope: "spatial_unit",
  });

  const produced_reference_views: ReferenceViewV1[] = [];
  const produced_lb_candidates: LBCandidateV1[] =
    input.options?.include_lb_candidates
      ? deriveLBCandidates(run_id, ps)
      : [];

  const { determinism_hash, input_bundle } = this.hashBundle({
    subjectRef,
    scale,
    window,
    config_profile,
    ssot_hash,
    effective_config_hash,
    factIds,
    reference_view_ids: [],
  });

  return {
    input_bundle,
    produced_reference_views,
    produced_lb_candidates,
    output: {
      determinism_hash,
      effective_config_hash,
      problem_states: [ps],
      ao_sense: deriveAoSense(run_id, ps),
      reference_views: input.options?.include_reference_views ? [] : undefined,
      lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
      silent: false,
      run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
      input_fact_ids: factIds,
    },
  };
}
    // Stage-4: QC
    const qc = evaluateQC(cfg, samples);
    if (qc && !qc.ok) {
      const supporting: EvidenceRef[] = [this.makeQCSummaryRef(qc, window)];
      if (ledgerRef) supporting.push(ledgerRef);

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: qc.problem_type,
        confidence: "HIGH",
        uncertainty_sources: qc.uncertainty_sources,
        summary: qc.summary,
        metrics_involved: qc.metrics_involved,
        sensors_involved: qc.sensors_involved,
        supporting_evidence_refs: supporting,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: qc.problem_scope,
      });

      const produced_reference_views: ReferenceViewV1[] = [];
      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: [],
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? [] : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    // Stage-5: Reference Assembly (pipeline-determined; payload gating happens later)
    const produced_reference_views = await this.buildReferenceViews({ cfg, subjectRef, scale, window, samples });

    // Stage-6: Conflict Detection (AII-04 §3.5, ref conflict has priority)
    const refConflict = detectReferenceConflict(produced_reference_views);
    if (refConflict) {
      const supporting: EvidenceRef[] = [];

      // Only include reference views that actually triggered conflict.
      for (const rv of produced_reference_views) {
        if (refConflict.metrics.includes(rv.metric)) {
          supporting.push({ kind: "reference_view", ref_id: rv.reference_view_id, time_range: { ...window } });
        }
      }

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: "REFERENCE_CONFLICT",
        confidence: "HIGH",
        uncertainty_sources: ["REFERENCE_DISAGREEMENT"],
        summary: "reference conflict",
        metrics_involved: refConflict.metrics,
        sensors_involved,
        supporting_evidence_refs: supporting,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: "reference_view",
      });

      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: supporting.map((r) => r.ref_id).sort(),
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? produced_reference_views : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    const evConflict = detectEvidenceConflict(cfg, samples, cfg.required_metrics, window);
    if (evConflict) {
      const supporting: EvidenceRef[] = [];
      if (ledgerRef) supporting.push(ledgerRef);

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: "EVIDENCE_CONFLICT",
        confidence: "HIGH",
        uncertainty_sources: ["MULTI_SOURCE_INCONSISTENCY"],
        summary: "evidence conflict",
        metrics_involved: evConflict.conflictedMetrics,
        sensors_involved: evConflict.sensorsInvolved,
        supporting_evidence_refs: supporting.length ? supporting : undefined,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: "spatial_unit",
      });

      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: produced_reference_views.map((r) => r.reference_view_id).sort(),
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? produced_reference_views : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    // Stage-7: Scale Policy Check (AII-04 §3.6)
    // Trigger only when a cross-scale dependency is detected.
    const crossScaleDetected = produced_reference_views.some((rv) => rv.scale !== scale);
    if (crossScaleDetected) {
      const supporting: EvidenceRef[] = [];
      for (const rv of produced_reference_views) {
        supporting.push({ kind: "reference_view", ref_id: rv.reference_view_id, note: "reference view", time_range: { ...window } });
      }
      if (ledgerRef) supporting.push(ledgerRef);
      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: "SCALE_POLICY_BLOCKED",
        confidence: "HIGH",
        uncertainty_sources: ["SCALE_POLICY_LIMITATION"],
        summary: "scale policy limitation",
        metrics_involved,
        sensors_involved,
        supporting_evidence_refs: supporting.length ? supporting : undefined,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: "unknown",
      });

      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: produced_reference_views.map((r) => r.reference_view_id).sort(),
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? produced_reference_views : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    // Stage-8: Marker Exclusion
    const markerHit = checkMarkers(cfg, window, markers);
    if (markerHit) {
      const supporting: EvidenceRef[] = [];
      if (ledgerRef) supporting.push(ledgerRef);

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type: markerHit.problem_type,
        confidence: markerHit.confidence,
        uncertainty_sources: markerHit.uncertainty_sources,
        summary: markerHit.summary,
        metrics_involved,
        sensors_involved,
        supporting_evidence_refs: supporting.length ? supporting : undefined,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: "spatial_unit",
        system_degraded: markerHit.problem_type === "EXCLUSION_WINDOW_ACTIVE",
      });

      const produced_lb_candidates: LBCandidateV1[] = input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];
      const { determinism_hash, input_bundle } = this.hashBundle({
        subjectRef,
        scale,
        window,
        config_profile,
        ssot_hash,
        effective_config_hash,
        factIds,
        reference_view_ids: produced_reference_views.map((r) => r.reference_view_id).sort(),
      });

      return {
        input_bundle,
        produced_reference_views,
        produced_lb_candidates,
        output: {
          determinism_hash,
          effective_config_hash,
          problem_states: [ps],
          ao_sense: deriveAoSense(run_id, ps),
          reference_views: input.options?.include_reference_views ? produced_reference_views : undefined,
          lb_candidates: input.options?.include_lb_candidates ? produced_lb_candidates : undefined,
          silent: false,
          run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
          input_fact_ids: factIds,
        },
      };
    }

    // Stage-9: Silent by default (no declarable ProblemState)
    const { determinism_hash, input_bundle } = this.hashBundle({
      subjectRef,
      scale,
      window,
      config_profile,
      ssot_hash,
      effective_config_hash,
      factIds,
      reference_view_ids: produced_reference_views.map((r) => r.reference_view_id).sort(),
    });

    const produced_lb_candidates: LBCandidateV1[] = [];
    return {
      input_bundle,
      produced_reference_views,
      produced_lb_candidates,
      output: {
        determinism_hash,
        effective_config_hash,
        problem_states: [],
        ao_sense: [],
        reference_views: input.options?.include_reference_views ? produced_reference_views : undefined,
        lb_candidates: input.options?.include_lb_candidates ? [] : undefined,
        silent: true,
        run_meta: { pipeline_version: "judge_pipeline_v1", config_profile },
        input_fact_ids: factIds,
      },
    };
  }
}
