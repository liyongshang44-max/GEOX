import assert from "node:assert/strict";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  McftCap09ExternalFormalCollectorPhaseOrchestratorV1,
  type ExternalFormalCollectorPipelineJobV1,
  type ExternalFormalCollectorSlotAuthorityV1,
  type ExternalFormalEvidenceIngressPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import type {
  GovernedDecodedEvidenceDraftV1,
  RawEvidenceRetentionInputV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";

const T = "2026-08-11T17:00:00.000Z";
const SLOT: ExternalFormalCollectorSlotAuthorityV1 = {
  epoch_id: "mcft_cap09_external_formal_window_epoch_20260811t170000z_v1",
  slot_id: "O00",
  scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
  logical_time: T,
  pre_boundary_causal_collector_target: "2026-08-11T16:30:00.000Z",
  late_exact_hour_collector_scheduled: "2026-08-11T23:30:00.000Z",
  late_exact_hour_evidence_cutoff: "2026-08-12T00:12:00.000Z",
};

function draft(input: {
  role: GovernedDecodedEvidenceDraftV1["role"];
  source_record_id: string;
  binding_id: string;
  epistemic_class: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
}): GovernedDecodedEvidenceDraftV1 {
  return {
    role: input.role,
    source_record_id: input.source_record_id,
    binding_id: input.binding_id,
    origin_source_kind: "EXTERNAL_FORMAL_ACCEPTANCE_SOURCE",
    origin_source_id: `source_${input.source_record_id}`,
    epistemic_class: input.epistemic_class,
    available_to_runtime_at: input.available_to_runtime_at,
    role_time: { ...input.role_time },
    quality: { status: "PASS" },
    source_payload: { acceptance_probe: true },
    canonical_payload: { acceptance_probe: true, source_record_id: input.source_record_id },
    source_unit: "unit_source",
    canonical_unit: "unit_canonical",
    conversion_rule: {
      conversion_rule_id: "EA5E2_ACCEPTANCE_IDENTITY_V1",
      conversion_rule_version: "1",
      authority_ref: "EA5E2_ACCEPTANCE_ONLY",
    },
    source_binding_version: 1,
    limitations: ["EA5E2_ACCEPTANCE_ONLY_NOT_FORMAL_DATA"],
  };
}

function makeJob(input: {
  request_id: string;
  requested_at: string;
  canonicalized_at: string;
  drafts: readonly GovernedDecodedEvidenceDraftV1[];
  events: string[];
}): ExternalFormalCollectorPipelineJobV1 {
  const bytes = new TextEncoder().encode(`raw:${input.request_id}`);
  return {
    pipeline_input: {
      dataset_id: `dataset_${input.request_id}`,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: {
        request_id: input.request_id,
        provider_id: "EA5E2_ACCEPTANCE_PROVIDER",
        source_family: `family_${input.request_id}`,
        locator: `https://example.test/${input.request_id}`,
        allowed_final_hosts: ["example.test"],
        use_policy_ref: "EA5E2_ACCEPTANCE_USE_POLICY",
        requested_at: input.requested_at,
        expected_content_type_prefixes: ["application/octet-stream"],
        limitations: ["EA5E2_ACCEPTANCE_ONLY"],
      },
      canonicalized_at: input.canonicalized_at,
    },
    ports: {
      transport: {
        async fetchRawEvidence(request) {
          input.events.push(`transport:${request.request_id}`);
          return {
            status: 200,
            final_locator: request.locator,
            content_type: "application/octet-stream",
            retrieved_at: new Date(Date.parse(request.requested_at) + 60_000).toISOString(),
            available_at: request.requested_at,
            bytes,
          };
        },
      },
      retention: {
        async retainRawEvidence(retentionInput: RawEvidenceRetentionInputV1) {
          input.events.push(`retention:${retentionInput.request_id}`);
          assert.equal(retentionInput.raw_bytes, bytes.byteLength);
          return {
            retention_class: "PRIVATE_RESTRICTED_RAW_EVIDENCE",
            retention_ref: `s3-private://ea5e2-acceptance/${retentionInput.request_id}`,
            retained_sha256: retentionInput.raw_sha256,
            retained_bytes: retentionInput.raw_bytes,
            retained_at: new Date(Date.parse(retentionInput.retrieved_at) + 30_000).toISOString(),
            externally_publishable: false,
          };
        },
      },
      decoder: {
        decoder_id: `decoder_${input.request_id}`,
        decoder_version: "1",
        async decodeRetainedEvidence() {
          input.events.push(`decoder:${input.request_id}`);
          return input.drafts.map((value) => structuredClone(value));
        },
      },
    },
  };
}

function noWriteIngress(events: string[]): { port: ExternalFormalEvidenceIngressPortV1; count: () => number } {
  let calls = 0;
  return {
    port: {
      async appendCanonicalizedExternalEvidence(result) {
        calls += 1;
        events.push(`ingress:${result.record.record_type}:${result.record.source_record_id}`);
        return {
          record_type: result.record.record_type,
          source_record_id: result.record.source_record_id,
          canonical_fact_write_count: 0,
        };
      },
    },
    count: () => calls,
  };
}

async function expectReject(fn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => error instanceof Error && error.message.includes(code));
}

async function main(): Promise<void> {
  const orchestrator = new McftCap09ExternalFormalCollectorPhaseOrchestratorV1(SLOT);
  const expectedSlotKey = `${SLOT.epoch_id}|${SLOT.slot_id}|${SLOT.logical_time}`;
  assert.equal(orchestrator.slot_key, expectedSlotKey);

  const preEvents: string[] = [];
  const preIngress = noWriteIngress(preEvents);
  const preResult = await orchestrator.executePhase({
    phase: "PRE_BOUNDARY_CAUSAL",
    jobs: [
      makeJob({
        request_id: "soil",
        requested_at: "2026-08-11T16:30:00.000Z",
        canonicalized_at: "2026-08-11T16:34:00.000Z",
        events: preEvents,
        drafts: [draft({
          role: "SOIL_MOISTURE_OBSERVATION",
          source_record_id: "soil_o00",
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
          epistemic_class: "OBSERVED",
          available_to_runtime_at: "2026-08-11T16:32:00.000Z",
          role_time: { observed_at: "2026-08-11T16:25:00.000Z", ingested_at: "2026-08-11T16:33:00.000Z" },
        })],
      }),
      makeJob({
        request_id: "future_weather",
        requested_at: "2026-08-11T16:35:00.000Z",
        canonicalized_at: "2026-08-11T16:39:00.000Z",
        events: preEvents,
        drafts: [draft({
          role: "FUTURE_WEATHER_ASSUMPTION",
          source_record_id: "future_weather_o00",
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
          epistemic_class: "ASSUMED",
          available_to_runtime_at: "2026-08-11T16:37:00.000Z",
          role_time: { issued_at: "2026-08-11T12:00:00.000Z", ingested_at: "2026-08-11T16:38:00.000Z" },
        })],
      }),
      makeJob({
        request_id: "future_et0",
        requested_at: "2026-08-11T16:40:00.000Z",
        canonicalized_at: "2026-08-11T16:44:00.000Z",
        events: preEvents,
        drafts: [draft({
          role: "FUTURE_ET0_ASSUMPTION",
          source_record_id: "future_et0_o00",
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
          epistemic_class: "ASSUMED",
          available_to_runtime_at: "2026-08-11T16:42:00.000Z",
          role_time: { issued_at: "2026-08-11T12:00:00.000Z", ingested_at: "2026-08-11T16:43:00.000Z" },
        })],
      }),
    ],
    ingress: preIngress.port,
  });
  assert.equal(preResult.slot_key, expectedSlotKey);
  assert.equal(preResult.provider_request_count, 3);
  assert.equal(preResult.canonical_record_count, 3);
  assert.equal(preResult.ingress_attempt_count, 3);
  assert.equal(preResult.canonical_fact_write_count, 0);
  assert.deepEqual(new Set(preResult.record_types), new Set([
    "soil_moisture_observation_v1",
    "future_weather_assumption_v1",
    "future_et0_assumption_v1",
  ]));
  assert.equal(preIngress.count(), 3);
  assert.ok(preEvents.findIndex((value) => value.startsWith("ingress:")) > preEvents.map((value, index) => value.startsWith("decoder:") ? index : -1).reduce((a, b) => Math.max(a, b), -1));
  for (const requestId of ["soil", "future_weather", "future_et0"]) {
    assert.ok(preEvents.indexOf(`transport:${requestId}`) < preEvents.indexOf(`retention:${requestId}`));
    assert.ok(preEvents.indexOf(`retention:${requestId}`) < preEvents.indexOf(`decoder:${requestId}`));
  }

  const lateEvents: string[] = [];
  const lateIngress = noWriteIngress(lateEvents);
  const lateResult = await orchestrator.executePhase({
    phase: "LATE_EXACT_HOUR",
    jobs: [makeJob({
      request_id: "kbs_raw_hourly",
      requested_at: "2026-08-11T23:30:00.000Z",
      canonicalized_at: "2026-08-11T23:35:00.000Z",
      events: lateEvents,
      drafts: [
        draft({
          role: "RAINFALL_OBSERVATION",
          source_record_id: "rain_o00",
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
          epistemic_class: "OBSERVED",
          available_to_runtime_at: "2026-08-11T23:33:00.000Z",
          role_time: { interval_start: "2026-08-11T16:00:00.000Z", interval_end: T, ingested_at: "2026-08-11T23:34:00.000Z" },
        }),
        draft({
          role: "HISTORICAL_ET0_INPUT",
          source_record_id: "hist_et0_o00",
          binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
          epistemic_class: "ESTIMATED",
          available_to_runtime_at: "2026-08-11T23:33:00.000Z",
          role_time: {
            interval_start: "2026-08-11T16:00:00.000Z",
            interval_end: T,
            ingested_at: "2026-08-11T23:34:00.000Z",
            calculation_method: "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
            method_version: "1",
          },
        }),
      ],
    })],
    ingress: lateIngress.port,
  });
  assert.equal(lateResult.slot_key, expectedSlotKey);
  assert.equal(lateResult.provider_request_count, 1);
  assert.equal(lateResult.canonical_record_count, 2);
  assert.equal(lateResult.ingress_attempt_count, 2);
  assert.equal(lateResult.canonical_fact_write_count, 0);
  assert.deepEqual(new Set(lateResult.record_types), new Set(["observed_rainfall_v1", "historical_et0_estimate_v1"]));
  assert.equal(lateIngress.count(), 2);
  assert.ok(lateEvents.findIndex((value) => value.startsWith("ingress:")) > lateEvents.map((value, index) => value.startsWith("decoder:") ? index : -1).reduce((a, b) => Math.max(a, b), -1));

  const earlyEvents: string[] = [];
  const earlyIngress = noWriteIngress(earlyEvents);
  await expectReject(() => orchestrator.executePhase({
    phase: "LATE_EXACT_HOUR",
    jobs: [makeJob({
      request_id: "early_late",
      requested_at: "2026-08-11T23:29:59.000Z",
      canonicalized_at: "2026-08-11T23:31:00.000Z",
      events: earlyEvents,
      drafts: [],
    })],
    ingress: earlyIngress.port,
  }), "EA5E2_COLLECTOR_PHASE_STARTED_BEFORE_AUTHORIZED_TARGET");
  assert.equal(earlyEvents.length, 0);
  assert.equal(earlyIngress.count(), 0);

  const wrongPhaseEvents: string[] = [];
  const wrongPhaseIngress = noWriteIngress(wrongPhaseEvents);
  await expectReject(() => orchestrator.executePhase({
    phase: "PRE_BOUNDARY_CAUSAL",
    jobs: [makeJob({
      request_id: "wrong_phase_rain",
      requested_at: "2026-08-11T16:30:00.000Z",
      canonicalized_at: T,
      events: wrongPhaseEvents,
      drafts: [draft({
        role: "RAINFALL_OBSERVATION",
        source_record_id: "wrong_phase_rain_o00",
        binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
        epistemic_class: "OBSERVED",
        available_to_runtime_at: T,
        role_time: { interval_start: "2026-08-11T16:00:00.000Z", interval_end: T, ingested_at: T },
      })],
    })],
    ingress: wrongPhaseIngress.port,
  }), "EA5E2_COLLECTOR_RECORD_TYPE_WRONG_PHASE");
  assert.equal(wrongPhaseIngress.count(), 0);

  const missingEvents: string[] = [];
  const missingIngress = noWriteIngress(missingEvents);
  await expectReject(() => orchestrator.executePhase({
    phase: "PRE_BOUNDARY_CAUSAL",
    jobs: [makeJob({
      request_id: "missing_families",
      requested_at: "2026-08-11T16:30:00.000Z",
      canonicalized_at: "2026-08-11T16:34:00.000Z",
      events: missingEvents,
      drafts: [draft({
        role: "SOIL_MOISTURE_OBSERVATION",
        source_record_id: "only_soil_o00",
        binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        epistemic_class: "OBSERVED",
        available_to_runtime_at: "2026-08-11T16:32:00.000Z",
        role_time: { observed_at: "2026-08-11T16:25:00.000Z", ingested_at: "2026-08-11T16:33:00.000Z" },
      })],
    })],
    ingress: missingIngress.port,
  }), "EA5E2_COLLECTOR_REQUIRED_PHASE_FAMILY_MISSING");
  assert.equal(missingIngress.count(), 0);

  assert.throws(() => new McftCap09ExternalFormalCollectorPhaseOrchestratorV1({
    ...SLOT,
    late_exact_hour_collector_scheduled: "2026-08-11T23:29:00.000Z",
  }), /EA5E2_COLLECTOR_LATE_OFFSET_MISMATCH/);

  console.log(JSON.stringify({
    status: "PASS",
    slot_key: expectedSlotKey,
    pre_boundary_provider_request_count: preResult.provider_request_count,
    pre_boundary_record_count: preResult.canonical_record_count,
    late_exact_provider_request_count: lateResult.provider_request_count,
    late_exact_record_count: lateResult.canonical_record_count,
    canonical_fact_write_count: preResult.canonical_fact_write_count + lateResult.canonical_fact_write_count,
    whole_phase_validation_before_ingress: true,
    raw_retention_before_decode: true,
    same_slot_key_both_phases: preResult.slot_key === lateResult.slot_key,
    wrong_phase_ingress_count: wrongPhaseIngress.count(),
    missing_family_ingress_count: missingIngress.count(),
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});