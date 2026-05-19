import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  PEST_DISEASE_INSPECTION_FACT_TYPES_V1,
  PEST_DISEASE_INSPECTION_TARGET_TYPES_V1,
  PEST_DISEASE_INSPECTION_TRIGGER_SOURCES_V1,
  type PestDiseaseDeviceModelV1,
  type PestDiseaseDeviceProfileV1,
  type PestDiseaseDeviceTypeV1,
  type PestDiseaseEvidenceQualityV1,
  type PestDiseaseInspectionAcceptanceFactV1,
  type PestDiseaseInspectionAssessmentFactV1,
  type PestDiseaseInspectionAssessmentStatusV1,
  type PestDiseaseInspectionConfidenceV1,
  type PestDiseaseInspectionEvidenceRefV1,
  type PestDiseaseInspectionEvidenceTierV1,
  type PestDiseaseInspectionPriorityV1,
  type PestDiseaseInspectionRequestFactV1,
  type PestDiseaseInspectionReviewFactV1,
  type PestDiseaseInspectionReviewStatusV1,
  type PestDiseaseInspectionSeverityV1,
  type PestDiseaseInspectionTargetTypeV1,
  type PestDiseaseMediaKindV1,
  type PestDiseaseObservationFactV1,
  type PestDiseasePlantPartV1,
  type PestDiseaseSignalFactV1,
  type PestDiseaseSignalTypeV1,
} from "../../domain/inspection/pest_disease_inspection_contract_v1.js";

export class PestDiseaseInspectionServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message?: string) {
    super(message ?? code);
    this.statusCode = statusCode;
    this.code = code;
  }
}

type FactRow = { fact_id: string; occurred_at: string; source: string; record_json: any };
type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

const INSERT_FACT_SQL = `
  INSERT INTO facts (fact_id, occurred_at, source, record_json)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (fact_id) DO NOTHING
  RETURNING fact_id
`;

const DEVICE_MODELS = new Set<PestDiseaseDeviceModelV1>([
  "PHONE_CAMERA",
  "DJI_MAVIC_3E",
  "DJI_MAVIC_3M",
  "DJI_MAVIC_3T",
  "SENTERA_6X",
  "MICASENSE_REDEDGE_P",
  "FIXED_PEST_TRAP_GENERIC",
  "TRAPVIEW_TRAP",
  "MANUAL_SCOUT",
  "OTHER",
]);

const DEVICE_TYPES = new Set<PestDiseaseDeviceTypeV1>([
  "PHONE",
  "UAV_RGB",
  "UAV_MULTISPECTRAL",
  "UAV_THERMAL",
  "FIXED_TRAP",
  "SCOUTING_APP",
  "MANUAL",
]);

const MEDIA_KINDS = new Set<PestDiseaseMediaKindV1>([
  "IMAGE",
  "VIDEO",
  "MULTISPECTRAL_MAP",
  "THERMAL_IMAGE",
  "TRAP_IMAGE",
]);

const PLANT_PARTS = new Set<PestDiseasePlantPartV1>([
  "LEAF",
  "STEM",
  "ROOT",
  "FRUIT",
  "CANOPY",
  "TRAP",
  "UNKNOWN",
]);

const EVIDENCE_QUALITIES = new Set<PestDiseaseEvidenceQualityV1>([
  "COMPLETE",
  "PARTIAL",
  "MISSING_GEO",
  "MISSING_MEDIA",
  "LOW_QUALITY_IMAGE",
]);

const SIGNAL_TYPES = new Set<PestDiseaseSignalTypeV1>(["PEST_SIGNAL", "DISEASE_SIGNAL", "WEED_SIGNAL", "CROP_STRESS_SIGNAL"]);
const CONFIDENCE_VALUES = new Set<PestDiseaseInspectionConfidenceV1>(["HIGH", "MEDIUM", "LOW"]);
const PRIORITY_VALUES = new Set<PestDiseaseInspectionPriorityV1>(["LOW", "NORMAL", "HIGH", "URGENT"]);
const ASSESSMENT_STATUSES = new Set<PestDiseaseInspectionAssessmentStatusV1>([
  "CONFIRMED",
  "SUSPECTED",
  "RULED_OUT",
  "NEEDS_REVIEW",
  "INSUFFICIENT_EVIDENCE",
]);
const SEVERITY_VALUES = new Set<PestDiseaseInspectionSeverityV1>(["NONE", "LOW", "MEDIUM", "HIGH", "NEEDS_REVIEW"]);
const EVIDENCE_TIERS = new Set<PestDiseaseInspectionEvidenceTierV1>(["FORMAL", "TECHNICAL", "WARNING", "MANUAL_REVIEW"]);
const REVIEW_STATUSES = new Set<PestDiseaseInspectionReviewStatusV1>(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED", "ESCALATED"]);

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function mustText(value: unknown, field: string): string {
  const v = text(value);
  if (!v) throw new PestDiseaseInspectionServiceError(400, `MISSING_OR_INVALID:${field}`);
  return v;
}

function intMs(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || Math.floor(n) !== n || n <= 0) {
    throw new PestDiseaseInspectionServiceError(400, `MISSING_OR_INVALID:${field}`);
  }
  return n;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function listText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => text(x)).filter((x): x is string => Boolean(x));
}

function parseRecordJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function isReadonlySet<T extends string>(
  value: ReadonlySet<T> | readonly T[],
): value is ReadonlySet<T> {
  return typeof (value as ReadonlySet<T>).has === "function";
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T> | readonly T[], field: string): T {
  const v = mustText(value, field) as T;
  const ok = isReadonlySet(allowed) ? allowed.has(v) : allowed.includes(v);
  if (!ok) throw new PestDiseaseInspectionServiceError(400, `INVALID_ENUM:${field}`);
  return v;
}

function optionalEnumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, field: string, fallback: T): T {
  if (value == null || value === "") return fallback;
  return enumValue(value, allowed, field);
}

function normalizeTenantFromBody(body: any): TenantTriple & { field_id: string; zone_id: string | null } {
  return {
    tenant_id: mustText(body?.tenant_id, "tenant_id"),
    project_id: mustText(body?.project_id, "project_id"),
    group_id: mustText(body?.group_id, "group_id"),
    field_id: mustText(body?.field_id, "field_id"),
    zone_id: text(body?.zone_id),
  };
}

function assertTenantMatchesAuth(auth: AoActAuthContextV0, tenant: TenantTriple): void {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    throw new PestDiseaseInspectionServiceError(403, "TENANT_SCOPE_DENIED");
  }
}

function normalizeEvidenceRefs(input: unknown): PestDiseaseInspectionEvidenceRefV1[] {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => {
    const kind = mustText((item as any)?.kind, `evidence_refs[${index}].kind`);
    const ref_id = mustText((item as any)?.ref_id, `evidence_refs[${index}].ref_id`);
    return { kind, ref_id };
  });
}

function normalizeMediaRefs(input: unknown): PestDiseaseObservationFactV1["media_refs"] {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => ({
    kind: enumValue((item as any)?.kind, MEDIA_KINDS, `media_refs[${index}].kind`),
    ref_id: mustText((item as any)?.ref_id, `media_refs[${index}].ref_id`),
    checksum: text((item as any)?.checksum),
  }));
}

function normalizeGeoPoint(input: unknown): { lat: number; lng: number } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const lat = numOrNull((input as any).lat);
  const lng = numOrNull((input as any).lng);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new PestDiseaseInspectionServiceError(400, "INVALID_GEO_POINT");
  }
  return { lat, lng };
}

function normalizeDeviceProfile(input: unknown): PestDiseaseDeviceProfileV1 | null {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new PestDiseaseInspectionServiceError(400, "INVALID_DEVICE_PROFILE");
  }
  return {
    device_id: text((input as any).device_id),
    device_model: enumValue((input as any).device_model, DEVICE_MODELS, "device_profile.device_model"),
    device_type: enumValue((input as any).device_type, DEVICE_TYPES, "device_profile.device_type"),
    capabilities: listText((input as any).capabilities),
  };
}

function deriveEvidenceQuality(params: { requested: unknown; mediaCount: number; hasGeo: boolean }): PestDiseaseEvidenceQualityV1 {
  const requested = params.requested == null || params.requested === ""
    ? "COMPLETE"
    : enumValue(params.requested, EVIDENCE_QUALITIES, "evidence_quality");
  if (params.mediaCount < 1) return "MISSING_MEDIA";
  if (!params.hasGeo && requested === "COMPLETE") return "MISSING_GEO";
  if (!params.hasGeo && requested === "PARTIAL") return "MISSING_GEO";
  return requested;
}

async function insertFact(pool: Pool, fact_id: string, record_json: any): Promise<{ fact_id: string }> {
  const created = Number(record_json.created_at_ts ?? record_json.requested_at_ts ?? record_json.evaluated_at_ts ?? Date.now());
  const occurred_at = new Date(created).toISOString();
  const res = await pool.query(INSERT_FACT_SQL, [fact_id, occurred_at, "inspection", JSON.stringify(record_json)]);
  if (!res.rows || res.rows.length < 1) {
    throw new PestDiseaseInspectionServiceError(500, "FACT_INSERT_CONFLICT_OR_FAILED");
  }
  return { fact_id };
}

async function queryFactsByInspectionId(pool: Pool, inspection_id: string): Promise<FactRow[]> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'inspection_id') = $1
         OR (record_json::jsonb#>>'{payload,inspection_id}') = $1
      ORDER BY occurred_at ASC, fact_id ASC`,
    [inspection_id],
  );
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    source: String(row.source ?? ""),
    record_json: parseRecordJson(row.record_json),
  }));
}

async function queryAssessmentById(pool: Pool, assessment_id: string): Promise<FactRow | null> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, source, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'pest_disease_inspection_assessment_v1'
        AND (record_json::jsonb->>'assessment_id') = $1
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [assessment_id],
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    source: String(row.source ?? ""),
    record_json: parseRecordJson(row.record_json),
  };
}

function splitInspectionFacts(facts: FactRow[]) {
  const byType = new Set(PEST_DISEASE_INSPECTION_FACT_TYPES_V1);
  const domainFacts = facts.filter((row) => byType.has(String(row.record_json?.type ?? "") as any));
  return {
    request: domainFacts.find((row) => row.record_json?.type === "pest_disease_inspection_request_v1") ?? null,
    observations: domainFacts.filter((row) => row.record_json?.type === "pest_disease_observation_v1"),
    signals: domainFacts.filter((row) => row.record_json?.type === "pest_disease_signal_v1"),
    assessments: domainFacts.filter((row) => row.record_json?.type === "pest_disease_inspection_assessment_v1"),
    reviews: domainFacts.filter((row) => row.record_json?.type === "pest_disease_inspection_review_v1"),
    acceptances: domainFacts.filter((row) => row.record_json?.type === "pest_disease_inspection_acceptance_v1"),
    facts: domainFacts,
  };
}

function latestReviewStatus(reviews: FactRow[], assessment_id: string): string | null {
  const hit = [...reviews]
    .reverse()
    .find((row) => String(row.record_json?.assessment_id ?? "") === assessment_id);
  return text(hit?.record_json?.review_status);
}

function hasApprovedReview(reviews: FactRow[], assessment_id: string): boolean {
  return latestReviewStatus(reviews, assessment_id) === "APPROVED";
}

function observationEvidenceState(observations: FactRow[], observationRefs: string[]) {
  const refs = new Set(observationRefs);
  const matched = observations.filter((row) => refs.has(String(row.record_json?.observation_id ?? "")) || refs.has(row.fact_id));
  if (observationRefs.length > 0 && matched.length < 1) {
    return { hasTime: false, hasGeo: false, hasMedia: false, matched };
  }
  const scoped = matched.length > 0 ? matched : observations;
  const hasTime = scoped.some((row) => Number.isFinite(Number(row.record_json?.captured_at_ts)) && Number(row.record_json?.captured_at_ts) > 0);
  const hasGeo = scoped.some((row) => {
    const geo = row.record_json?.geo_point;
    return geo && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));
  });
  const hasMedia = scoped.some((row) => Array.isArray(row.record_json?.media_refs) && row.record_json.media_refs.length > 0 && row.record_json?.evidence_quality !== "MISSING_MEDIA");
  return { hasTime, hasGeo, hasMedia, matched: scoped };
}

function buildChainValidation(params: { latestAssessment: any | null; reviews: FactRow[]; observations: FactRow[] }) {
  const assessment = params.latestAssessment;
  if (!assessment) {
    return { customer_visible_eligible: false, needs_review: false, blocking_reasons: ["missing:assessment"] };
  }
  const observationRefs = Array.isArray(assessment.observation_refs) ? assessment.observation_refs : [];
  const evidence = observationEvidenceState(params.observations, observationRefs);
  const latestReview = latestReviewStatus(params.reviews, String(assessment.assessment_id ?? ""));
  const blocking: string[] = [];
  if (!evidence.hasTime) blocking.push("missing:captured_at_ts");
  if (!evidence.hasGeo) blocking.push("missing:geo_evidence");
  if (!evidence.hasMedia) blocking.push("missing:media_evidence");
  if (assessment.review_required && latestReview !== "APPROVED") blocking.push("missing:approved_review");
  if (latestReview === "REJECTED") blocking.push("review:rejected");
  if (latestReview === "ESCALATED") blocking.push("review:escalated");
  const needs_review = Boolean(assessment.review_required) || latestReview === "REJECTED" || latestReview === "ESCALATED";
  return {
    customer_visible_eligible: Boolean(assessment.customer_visible_eligible) && blocking.length === 0,
    needs_review,
    latest_review_status: latestReview,
    blocking_reasons: blocking,
  };
}

export async function createPestDiseaseInspectionRequestV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const tenant = normalizeTenantFromBody(body);
  assertTenantMatchesAuth(auth, tenant);
  const inspection_id = text(body?.inspection_id) ?? `pdi_${randomUUID()}`;
  const requested_at_ts = intMs(body?.requested_at_ts ?? Date.now(), "requested_at_ts");
  const record: PestDiseaseInspectionRequestFactV1 = {
    type: "pest_disease_inspection_request_v1",
    schema_version: "1",
    inspection_id,
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: tenant.field_id,
    zone_id: tenant.zone_id,
    trigger_source: enumValue(body?.trigger_source, PEST_DISEASE_INSPECTION_TRIGGER_SOURCES_V1, "trigger_source"),
    requested_target: enumValue(body?.requested_target, PEST_DISEASE_INSPECTION_TARGET_TYPES_V1, "requested_target"),
    crop_code: text(body?.crop_code),
    crop_stage: text(body?.crop_stage),
    requested_at_ts,
    priority: optionalEnumValue(body?.priority, PRIORITY_VALUES, "priority", "NORMAL"),
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
    reasons: listText(body?.reasons),
  };
  const fact = await insertFact(pool, `pdir_${inspection_id}`, record);
  return { ...fact, inspection_id, record };
}

export async function createPestDiseaseObservationV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const tenant = normalizeTenantFromBody(body);
  assertTenantMatchesAuth(auth, tenant);
  const inspection_id = mustText(body?.inspection_id, "inspection_id");
  const observation_id = text(body?.observation_id) ?? `pdo_${randomUUID()}`;
  const geo_point = normalizeGeoPoint(body?.geo_point);
  const media_refs = normalizeMediaRefs(body?.media_refs);
  const record: PestDiseaseObservationFactV1 = {
    type: "pest_disease_observation_v1",
    schema_version: "1",
    observation_id,
    inspection_id,
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: tenant.field_id,
    zone_id: tenant.zone_id,
    captured_at_ts: intMs(body?.captured_at_ts, "captured_at_ts"),
    geo_point,
    device_profile: normalizeDeviceProfile(body?.device_profile),
    media_refs,
    scout_note: text(body?.scout_note),
    crop_stage: text(body?.crop_stage),
    plant_part: optionalEnumValue(body?.plant_part, PLANT_PARTS, "plant_part", "UNKNOWN"),
    target_type: enumValue(body?.target_type, PEST_DISEASE_INSPECTION_TARGET_TYPES_V1, "target_type"),
    suspected_issue_code: text(body?.suspected_issue_code),
    pest_count: numOrNull(body?.pest_count),
    trap_count: numOrNull(body?.trap_count),
    incidence_percent: numOrNull(body?.incidence_percent),
    severity_percent: numOrNull(body?.severity_percent),
    affected_area_percent: numOrNull(body?.affected_area_percent),
    evidence_quality: deriveEvidenceQuality({ requested: body?.evidence_quality, mediaCount: media_refs.length, hasGeo: Boolean(geo_point) }),
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
    created_at_ts: intMs(body?.created_at_ts ?? Date.now(), "created_at_ts"),
  };
  const fact = await insertFact(pool, `pdo_${observation_id}`, record);
  return { ...fact, inspection_id, observation_id, record };
}

export async function createPestDiseaseSignalV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const tenant = normalizeTenantFromBody(body);
  assertTenantMatchesAuth(auth, tenant);
  const inspection_id = mustText(body?.inspection_id, "inspection_id");
  const skill_id = text(body?.skill_id);
  const skill_run_id = text(body?.skill_run_id);
  if (!skill_id && !skill_run_id) throw new PestDiseaseInspectionServiceError(400, "MISSING_SKILL_ID_OR_SKILL_RUN_ID");
  const signal_id = text(body?.signal_id) ?? `pds_${randomUUID()}`;
  const record: PestDiseaseSignalFactV1 = {
    type: "pest_disease_signal_v1",
    schema_version: "1",
    signal_id,
    inspection_id,
    observation_id: text(body?.observation_id),
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: tenant.field_id,
    zone_id: tenant.zone_id,
    skill_id: skill_id ?? "unknown_skill",
    skill_run_id,
    skill_trace_id: text(body?.skill_trace_id),
    signal_type: enumValue(body?.signal_type, SIGNAL_TYPES, "signal_type"),
    candidate_issue_code: text(body?.candidate_issue_code),
    confidence: optionalEnumValue(body?.confidence, CONFIDENCE_VALUES, "confidence", "LOW"),
    reason_codes: listText(body?.reason_codes),
    missing_inputs: listText(body?.missing_inputs),
    uncertainty_notes: listText(body?.uncertainty_notes),
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
    created_at_ts: intMs(body?.created_at_ts ?? Date.now(), "created_at_ts"),
  };
  const fact = await insertFact(pool, `pds_${signal_id}`, record);
  return { ...fact, inspection_id, signal_id, record };
}

export async function createPestDiseaseInspectionAssessmentV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const tenant = normalizeTenantFromBody(body);
  assertTenantMatchesAuth(auth, tenant);
  const inspection_id = mustText(body?.inspection_id, "inspection_id");
  const observation_refs = listText(body?.observation_refs);
  const skill_signal_refs = Array.isArray(body?.skill_signal_refs)
    ? body.skill_signal_refs.map((item: any, index: number) => ({
      skill_id: mustText(item?.skill_id, `skill_signal_refs[${index}].skill_id`),
      skill_run_id: text(item?.skill_run_id),
      signal_id: text(item?.signal_id),
    }))
    : [];
  if (observation_refs.length < 1 && skill_signal_refs.length < 1) {
    throw new PestDiseaseInspectionServiceError(400, "ASSESSMENT_REQUIRES_OBSERVATION_OR_SIGNAL");
  }
  const assessment_status = enumValue(body?.assessment_status, ASSESSMENT_STATUSES, "assessment_status");
  if (observation_refs.length < 1 && skill_signal_refs.length > 0 && assessment_status === "CONFIRMED") {
    throw new PestDiseaseInspectionServiceError(400, "SKILL_SIGNAL_ONLY_CANNOT_CONFIRM");
  }

  const facts = await queryFactsByInspectionId(pool, inspection_id);
  const split = splitInspectionFacts(facts);
  const evidenceState = observationEvidenceState(split.observations, observation_refs);
  const confidence = optionalEnumValue(body?.confidence, CONFIDENCE_VALUES, "confidence", "LOW");
  let review_required = bool(body?.review_required, false);
  if (confidence === "LOW") review_required = true;
  const assessment_id = text(body?.assessment_id) ?? `pdia_${randomUUID()}`;
  const latestApproved = hasApprovedReview(split.reviews, assessment_id);
  const missingEvidence = !evidenceState.hasTime || !evidenceState.hasGeo || !evidenceState.hasMedia;
  const customer_visible_eligible = bool(body?.customer_visible_eligible, false)
    && !missingEvidence
    && !(assessment_status === "CONFIRMED" && review_required && !latestApproved);

  const blocking_reasons = Array.from(new Set([
    ...listText(body?.blocking_reasons),
    ...(!evidenceState.hasTime ? ["missing:captured_at_ts"] : []),
    ...(!evidenceState.hasGeo ? ["missing:geo_evidence"] : []),
    ...(!evidenceState.hasMedia ? ["missing:media_evidence"] : []),
    ...(assessment_status === "CONFIRMED" && review_required && !latestApproved ? ["missing:approved_review"] : []),
  ]));

  const record: PestDiseaseInspectionAssessmentFactV1 = {
    type: "pest_disease_inspection_assessment_v1",
    schema_version: "1",
    assessment_id,
    inspection_id,
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: tenant.field_id,
    zone_id: tenant.zone_id,
    target_type: enumValue(body?.target_type, PEST_DISEASE_INSPECTION_TARGET_TYPES_V1, "target_type") as PestDiseaseInspectionTargetTypeV1,
    suspected_issue_code: text(body?.suspected_issue_code),
    assessment_status,
    severity: optionalEnumValue(body?.severity, SEVERITY_VALUES, "severity", "NEEDS_REVIEW"),
    confidence,
    evidence_tier: optionalEnumValue(body?.evidence_tier, EVIDENCE_TIERS, "evidence_tier", "MANUAL_REVIEW"),
    review_required,
    customer_visible_eligible,
    observation_refs,
    skill_signal_refs,
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
    blocking_reasons,
    reasons: listText(body?.reasons),
    created_at_ts: intMs(body?.created_at_ts ?? Date.now(), "created_at_ts"),
  };
  const fact = await insertFact(pool, `pdia_${assessment_id}`, record);
  return { ...fact, inspection_id, assessment_id, record };
}

export async function createPestDiseaseInspectionReviewV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const tenant = normalizeTenantFromBody(body);
  assertTenantMatchesAuth(auth, tenant);
  const review_id = text(body?.review_id) ?? `pdirv_${randomUUID()}`;
  const record: PestDiseaseInspectionReviewFactV1 = {
    type: "pest_disease_inspection_review_v1",
    schema_version: "1",
    review_id,
    inspection_id: mustText(body?.inspection_id, "inspection_id"),
    assessment_id: mustText(body?.assessment_id, "assessment_id"),
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: tenant.field_id,
    review_status: enumValue(body?.review_status, REVIEW_STATUSES, "review_status"),
    reviewer_actor_id: text(body?.reviewer_actor_id ?? auth.actor_id),
    reviewed_at_ts: body?.reviewed_at_ts == null ? null : intMs(body?.reviewed_at_ts, "reviewed_at_ts"),
    review_note: text(body?.review_note),
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
  };
  const fact = await insertFact(pool, `pdirv_${review_id}`, record);
  return { ...fact, inspection_id: record.inspection_id, assessment_id: record.assessment_id, review_id, record };
}

export async function evaluatePestDiseaseInspectionAcceptanceV1(pool: Pool, body: any, auth: AoActAuthContextV0) {
  const assessment_id = mustText(body?.assessment_id, "assessment_id");
  const assessmentRow = await queryAssessmentById(pool, assessment_id);
  if (!assessmentRow) throw new PestDiseaseInspectionServiceError(404, "ASSESSMENT_NOT_FOUND");
  const assessment = assessmentRow.record_json;
  assertTenantMatchesAuth(auth, {
    tenant_id: String(assessment.tenant_id ?? ""),
    project_id: String(assessment.project_id ?? ""),
    group_id: String(assessment.group_id ?? ""),
  });
  const inspection_id = String(assessment.inspection_id ?? "");
  const facts = await queryFactsByInspectionId(pool, inspection_id);
  const split = splitInspectionFacts(facts);
  const observationRefs = Array.isArray(assessment.observation_refs) ? assessment.observation_refs.map((x: unknown) => String(x)) : [];
  const evidence = observationEvidenceState(split.observations, observationRefs);
  const human_review_satisfied = assessment.review_required ? hasApprovedReview(split.reviews, assessment_id) : true;
  const geo_evidence_present = evidence.hasGeo;
  const media_evidence_present = evidence.hasMedia;
  const evidence_complete = evidence.hasTime && geo_evidence_present && media_evidence_present && human_review_satisfied;
  const verdict = evidence_complete ? "PASS" : (!geo_evidence_present || !media_evidence_present ? "INSUFFICIENT_EVIDENCE" : "NEEDS_REVIEW");
  const reasons = Array.from(new Set([
    ...listText(body?.reasons),
    ...(!evidence.hasTime ? ["missing:captured_at_ts"] : []),
    ...(!geo_evidence_present ? ["missing:geo_evidence"] : []),
    ...(!media_evidence_present ? ["missing:media_evidence"] : []),
    ...(!human_review_satisfied ? ["missing:approved_review"] : []),
    ...(verdict === "PASS" ? ["inspection_acceptance_pass_means_evidence_chain_complete_not_spray"] : []),
  ]));
  const inspection_acceptance_id = text(body?.inspection_acceptance_id) ?? `pdiac_${randomUUID()}`;
  const record: PestDiseaseInspectionAcceptanceFactV1 = {
    type: "pest_disease_inspection_acceptance_v1",
    schema_version: "1",
    inspection_acceptance_id,
    inspection_id,
    assessment_id,
    tenant_id: String(assessment.tenant_id ?? ""),
    project_id: String(assessment.project_id ?? ""),
    group_id: String(assessment.group_id ?? ""),
    field_id: String(assessment.field_id ?? ""),
    verdict,
    evidence_complete,
    geo_evidence_present,
    media_evidence_present,
    human_review_satisfied,
    reasons,
    evidence_refs: normalizeEvidenceRefs(body?.evidence_refs),
    evaluated_at_ts: intMs(body?.evaluated_at_ts ?? Date.now(), "evaluated_at_ts"),
  };
  const fact = await insertFact(pool, `pdiac_${inspection_acceptance_id}`, record);
  return { ...fact, inspection_id, assessment_id, inspection_acceptance_id, record };
}

export async function getPestDiseaseInspectionV1(pool: Pool, inspection_id: string, auth: AoActAuthContextV0) {
  const id = mustText(inspection_id, "inspection_id");
  const facts = await queryFactsByInspectionId(pool, id);
  const split = splitInspectionFacts(facts);
  const tenant = split.request?.record_json ?? split.observations[0]?.record_json ?? split.assessments[0]?.record_json ?? null;
  if (!tenant) throw new PestDiseaseInspectionServiceError(404, "INSPECTION_NOT_FOUND");
  assertTenantMatchesAuth(auth, {
    tenant_id: String(tenant.tenant_id ?? ""),
    project_id: String(tenant.project_id ?? ""),
    group_id: String(tenant.group_id ?? ""),
  });
  const latestAssessment = split.assessments.length ? split.assessments[split.assessments.length - 1].record_json : null;
  return {
    inspection_id: id,
    request: split.request,
    observations: split.observations,
    signals: split.signals,
    assessments: split.assessments,
    reviews: split.reviews,
    acceptances: split.acceptances,
    chain_validation: buildChainValidation({ latestAssessment, reviews: split.reviews, observations: split.observations }),
  };
}
