import type { SkillRegistryItem, SkillRunSummary } from "../../../api/skills";

export type SkillOverviewMetric = {
  key: "registered" | "active" | "success" | "failed" | "abnormal";
  label: "已注册技能" | "激活中" | "成功" | "失败" | "异常技能";
  value: number;
  unit: "项" | "次";
  threshold: number;
};

export const SKILL_OVERVIEW_THRESHOLDS: Record<SkillOverviewMetric["key"], number> = {
  registered: 4,
  active: 1,
  success: 1,
  failed: 1,
  abnormal: 1,
};

const FAILED_STATUSES = new Set(["FAILED", "ERROR", "TIMEOUT"]);
const SUCCESS_STATUSES = new Set(["SUCCESS", "SUCCEEDED", "PASS"]);

function normalizeRunStatus(status: unknown): string {
  return String(status ?? "").trim().toUpperCase();
}

function isFailedRun(run: SkillRunSummary): boolean {
  return FAILED_STATUSES.has(normalizeRunStatus(run.status));
}

export function buildSkillOverviewMetrics(items: SkillRegistryItem[], runs: SkillRunSummary[]): SkillOverviewMetric[] {
  const registeredCount = items.length;
  const activeCount = items.filter((item) => String(item.status).toUpperCase() === "ACTIVE").length;
  const successCount = runs.filter((run) => SUCCESS_STATUSES.has(normalizeRunStatus(run.status))).length;
  const failedCount = runs.filter((run) => isFailedRun(run)).length;
  const abnormalSkillCount = new Set(
    runs
      .filter((run) => run.is_abnormal === true || isFailedRun(run))
      .map((run) => String(run.skill_id ?? "").trim())
      .filter(Boolean),
  ).size;

  return [
    { key: "registered", label: "已注册技能", value: registeredCount, unit: "项", threshold: SKILL_OVERVIEW_THRESHOLDS.registered },
    { key: "active", label: "激活中", value: activeCount, unit: "项", threshold: SKILL_OVERVIEW_THRESHOLDS.active },
    { key: "success", label: "成功", value: successCount, unit: "次", threshold: SKILL_OVERVIEW_THRESHOLDS.success },
    { key: "failed", label: "失败", value: failedCount, unit: "次", threshold: SKILL_OVERVIEW_THRESHOLDS.failed },
    { key: "abnormal", label: "异常技能", value: abnormalSkillCount, unit: "项", threshold: SKILL_OVERVIEW_THRESHOLDS.abnormal },
  ];
}
