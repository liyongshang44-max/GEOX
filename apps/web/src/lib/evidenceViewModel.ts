import { customerEvidenceGapCategory, customerTrustLevelText } from "./customerScenarioLabels";

export type EvidenceVm = {
  refs: Array<{ ref: string; type: "FORMAL" | "TECHNICAL" | "SIMULATED" | "MISSING"; label: string }>;
  gaps: string[];
  operatorGaps?: string[];
  trustLevel: "FORMAL" | "TECHNICAL_ONLY" | "SIMULATED" | "INSUFFICIENT";
  trustText: string;
  inspectionSummary?: {
    media_count: number;
    geo_evidence_present: boolean;
    reviewed_by_human: boolean;
    severity: string | null;
    confidence: string | null;
    review_required: boolean;
    blocking_reasons: string[];
  };
};

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export function buildEvidenceVm(input: any): EvidenceVm {
  const scenario = input?.formal_scenario ?? {};
  const chain = String(scenario.formal_chain_status ?? "").toUpperCase();
  const evidence = String(scenario.evidence_status ?? "").toUpperCase();
  const refs: EvidenceVm["refs"] = asList(input?.acceptance?.missing_items).map((gap) => ({ ref: gap, type: "MISSING" as const, label: "缺失项" }));
  const formalRefs = asList(input?.roi_ledger?.items?.flatMap?.((x: any) => x?.evidence_refs ?? []) ?? []);
  refs.push(...formalRefs.map((ref) => ({ ref, type: chain === "SIMULATED" ? "SIMULATED" as const : "FORMAL" as const, label: "证据引用" })));
  const inspection = input?.pest_disease_inspection ?? null;
  if (inspection) {
    refs.push({ ref: "pest_disease_inspection", type: inspection.acceptance_status === "PASS" ? "FORMAL" : "TECHNICAL", label: "病虫害巡检证据" });
  }
  const operatorGaps = [...asList(input?.acceptance?.missing_items), ...asList(scenario?.blocking_reasons), ...asList(inspection?.blocking_reasons)];
  const uniqueCategories: string[] = [];
  for (const gap of operatorGaps) {
    const category = customerEvidenceGapCategory(gap);
    if (!uniqueCategories.includes(category)) uniqueCategories.push(category);
  }
  const maxVisible = 4;
  const hiddenCount = Math.max(0, uniqueCategories.length - maxVisible);
  const gaps = hiddenCount > 0
    ? [...uniqueCategories.slice(0, maxVisible), `还有 ${hiddenCount} 项需运营复核`]
    : uniqueCategories;
  const trustLevel: EvidenceVm["trustLevel"] =
    chain === "PASSED" && evidence === "FORMAL_PASSED" ? "FORMAL"
      : chain === "SIMULATED" || evidence === "SIMULATED" ? "SIMULATED"
        : evidence === "TECHNICAL_ONLY" ? "TECHNICAL_ONLY"
          : "INSUFFICIENT";
  const inspectionSummary = inspection ? {
    media_count: Number(inspection.media_count ?? 0),
    geo_evidence_present: Boolean(inspection.geo_evidence_present),
    reviewed_by_human: Boolean(inspection.reviewed_by_human),
    severity: inspection.severity ?? null,
    confidence: inspection.confidence ?? null,
    review_required: Boolean(inspection.review_required),
    blocking_reasons: asList(inspection.blocking_reasons),
  } : undefined;
  return { refs, gaps, operatorGaps, trustLevel, trustText: customerTrustLevelText(trustLevel), inspectionSummary };
}
