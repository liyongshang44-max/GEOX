// apps/judge/src/pipeline.ts

import type { AppleIReader } from "./applei_reader"; // 确保导入正确
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
import {
  queryAoActLatestReceiptIndexV0,
  shouldExplainAoActReadModelV0,
  summarizeAoActIndexForLogV0,
} from "./ao_act_readmodel"; 

export type JudgeRunInput = {
  subjectRef: any;
  scale: string;
  window: { startTs: number; endTs: number };
  options?: {
    persist?: boolean;
    include_reference_views?: boolean;
    include_lb_candidates?: boolean;
    config_profile?: string;
    config_patch?: JudgeConfigPatchV1;
  };
};

export type JudgeRunOutput = {
  determinism_hash: string;
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
  }) 
  
  {
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

    const kinds = Array.isArray(args.cfg.reference?.kinds_enabled) ? args.cfg.reference.kinds_enabled : [];
    if (!kinds.includes("WITHIN_UNIT_HISTORY")) return [];

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
    const ssotCfg = loadDefaultConfig();
    const ssot_hash = computeSsotHash(ssotCfg);

    const patch = input.options?.config_patch;
    let cfg: any = ssotCfg;
    if (patch) {
      if (patch?.base?.ssot_hash !== ssot_hash) {
        throw new JudgeConfigPatchRejected(409, [
          {
            code: "SSOT_HASH_MISMATCH",
            path: "patch.base.ssot_hash",
            message: `ssot_hash mismatch: got=${String(patch?.base?.ssot_hash ?? "")} expected=${ssot_hash}`,
          },
        ]);
      }
      const manifest = getManifest(ssotCfg);
      const errors = validatePatchStrict(patch, manifest);
      if (errors.length) throw new JudgeConfigPatchRejected(400, errors);
      cfg = applyConfigPatch(ssotCfg, patch);
      validateEffectiveConfig(cfg);
    }

    const effective_config_hash = computeEffectiveConfigHash(cfg);

    const subjectRef = input.subjectRef;
    const scale = input.scale;
    const window = input.window;

    const rows = await this.reader.queryWindow({
      startTsMs: window.startTs,
      endTsMs: window.endTs,
      groupId: typeof subjectRef?.groupId === "string" ? subjectRef.groupId : undefined,
      spatialUnitId: typeof subjectRef?.spatialUnitId === "string" ? subjectRef.spatialUnitId : undefined,
      metrics: cfg.required_metrics,
    });
    const { samples, markers, factIds } = splitEvidence(rows);
    const ledgerRef = this.makeLedgerSliceRef(factIds, window);

    if (shouldExplainAoActReadModelV0()) {
      try {
        const idx = await queryAoActLatestReceiptIndexV0(this.reader, {
          startTsMs: window.startTs,
          endTsMs: window.endTs,
        });
        console.log("[judge][explain][ao_act_readmodel_v0]", summarizeAoActIndexForLogV0(idx));
      } catch (e: any) {
        console.warn("[judge][explain][ao_act_readmodel_v0][error]", String(e?.message ?? e));
      }
    }

    const sensors_involved = Array.from(
      new Set(
        (samples ?? [])
          .map((s: any): string | null => (typeof s?.sensorId === "string" ? s.sensorId : typeof s?.sensor_id === "string" ? s.sensor_id : null))
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      )
    ).sort();

    const metrics_involved = Array.from(
      new Set((samples ?? []).map((s: any): string | null => (typeof s?.metric === "string" ? s.metric : null)).filter((x): x is string => typeof x === "string" && x.length > 0))
    ).sort();

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
        confidence: (suff as any).confidence,  // Fix: use `as any`
        uncertainty_sources: (suff as any).uncertainty_sources,  // Fix: use `as any`
        summary: (suff as any).summary,  // Fix: use `as any`
        metrics_involved: (suff as any).metrics_involved,  // Fix: use `as any`
        sensors_involved: (suff as any).sensors_involved,  // Fix: use `as any`
        supporting_evidence_refs: supporting.length ? supporting : undefined,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: (suff as any).problem_scope,  // Fix: use `as any`
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
  const ts = samples.map((s: any) => s.ts as number).filter((t: number) => Number.isFinite(t)).sort((a: number, b: number) => a - b);
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
    if (qc && qc.ok === false) {
      const supporting: EvidenceRef[] = [this.makeQCSummaryRef(qc, window)];
      if (ledgerRef) supporting.push(ledgerRef);

      const problem_type =
        qc.flag === "QC_CONTAMINATION" ? "QC_CONTAMINATION" : "SENSOR_HEALTH_DEGRADED";

      const summary =
        qc.flag === "QC_CONTAMINATION"
          ? "quality-control contamination detected"
          : "sensor health degraded";

      const ps = makeProblemStateBase({
        subjectRef,
        scale,
        window,
        problem_type,
        confidence: "HIGH",
        uncertainty_sources: ["QC_FLAGGED"],
        summary,
        metrics_involved,
        sensors_involved,
        supporting_evidence_refs: supporting,
        state_layer_hint: "unknown",
        rate_class_hint: "unknown",
        problem_scope: "spatial_unit",
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
    const markerHit = checkMarkers(cfg, markers); // 调用新版 marker 检查函数，只传配置和 markers。
    if (!markerHit.ok) { // 只有命中排除规则时才进入 ProblemState 分支。
      const supporting: EvidenceRef[] = []; // supporting evidence 列表。
      if (ledgerRef) supporting.push(ledgerRef); // 有 ledger slice 时带上 ledger 证据。

      const markerProblemType = markerHit.flag; // 直接使用规则返回的 flag 作为 problem_type。
      const markerConfidence: "HIGH" = "HIGH"; // marker exclusion 命中时置信度固定为 HIGH。
      const markerUncertaintySources = ["MARKER_EXCLUSION"]; // 使用稳定的 uncertainty source。
      const markerSummary = `marker exclusion triggered: ${markerHit.flag}`; // 生成稳定摘要文案。
      const markerProblemScope: ProblemStateV1["problem_scope"] = "spatial_unit"; // marker exclusion 作用域固定为 spatial_unit。

      const ps = makeProblemStateBase({
        subjectRef, // 原 subjectRef。
        scale, // 原 scale。
        window, // 原 time window。
        problem_type: markerProblemType, // 使用 flag 作为 problem_type。
        confidence: markerConfidence, // 固定 HIGH。
        uncertainty_sources: markerUncertaintySources, // 固定 uncertainty sources。
        summary: markerSummary, // 固定摘要。
        metrics_involved, // 复用已汇总 metrics。
        sensors_involved, // 复用已汇总 sensors。
        supporting_evidence_refs: supporting.length ? supporting : undefined, // 有证据才写入。
        state_layer_hint: "unknown", // 保持原语义。
        rate_class_hint: "unknown", // 保持原语义。
        problem_scope: markerProblemScope, // 固定 spatial_unit。
        system_degraded: markerProblemType === "EXCLUSION_WINDOW_ACTIVE", // 仅排除窗口激活时标记 degraded。
      });

      const produced_lb_candidates: LBCandidateV1[] =
        input.options?.include_lb_candidates ? deriveLBCandidates(run_id, ps) : [];

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