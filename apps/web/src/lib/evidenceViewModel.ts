import { customerEvidenceGapText, customerTrustLevelText } from "./customerScenarioLabels";

export type EvidenceVm = {
  refs: Array<{ ref: string; type: "FORMAL" | "TECHNICAL" | "SIMULATED" | "MISSING"; label: string }>;
  gaps: string[];
  operatorGaps?: string[];
  trustLevel: "FORMAL" | "TECHNICAL_ONLY" | "SIMULATED" | "INSUFFICIENT";
  trustText: string;
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
  const operatorGaps = [...asList(input?.acceptance?.missing_items), ...asList(scenario?.blocking_reasons)];
  const gaps = operatorGaps.map((gap) => customerEvidenceGapText(gap));
  const trustLevel: EvidenceVm["trustLevel"] =
    chain === "PASSED" && evidence === "FORMAL_PASSED" ? "FORMAL"
      : chain === "SIMULATED" || evidence === "SIMULATED" ? "SIMULATED"
        : evidence === "TECHNICAL_ONLY" ? "TECHNICAL_ONLY"
          : "INSUFFICIENT";
  return { refs, gaps, operatorGaps, trustLevel, trustText: customerTrustLevelText(trustLevel) };
}
