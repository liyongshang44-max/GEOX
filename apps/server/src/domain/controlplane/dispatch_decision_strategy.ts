export type TenantProjectScope = {
  tenant_id: string;
  project_id: string;
};

export type DispatchTaskContext = {
  act_task_id: string;
  action_type?: string | null;
  field_id?: string | null;
  required_capabilities?: string[];
  location?: { lat: number; lon: number } | null;
};

export type DispatchExecutorResource = {
  executor_id: string;
  capabilities: string[];
  current_load: number;
  location?: { lat: number; lon: number } | null;
  status?: string | null;
};

export type DispatchSlaPolicy = {
  accept_minutes?: number | null;
  arrive_minutes?: number | null;
  urgency_level?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
};

export type DispatchDecisionInput = {
  scope: TenantProjectScope;
  task: DispatchTaskContext;
  executors: DispatchExecutorResource[];
  sla: DispatchSlaPolicy;
};

export type DispatchCandidate = {
  executor_id: string;
  priority: number;
  reasons: string[];
};

export type DispatchDecisionOutput = {
  candidates: DispatchCandidate[];
  explain: string;
};

export type DispatchDecisionStrategy = {
  name: string;
  evaluate(input: DispatchDecisionInput): DispatchDecisionOutput;
};

export type DispatchStrategyConfigEntry = {
  tenant_id?: string;
  project_id?: string;
  strategies: string[];
};

const DEFAULT_STRATEGY_NAMES = ["skill_match", "nearest_distance", "load_balance"];

const defaultDispatchStrategyConfig: DispatchStrategyConfigEntry[] = [
  { tenant_id: "*", project_id: "*", strategies: DEFAULT_STRATEGY_NAMES },
];

let runtimeDispatchStrategyConfig: DispatchStrategyConfigEntry[] = defaultDispatchStrategyConfig.map((x) => ({ ...x, strategies: [...x.strategies] }));
let runtimeConfigLoadedFromEnv = false;

function normalizeCaps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean))).slice(0, 64);
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const v1 = Math.sin(dLat / 2) ** 2;
  const v2 = Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(v1 + v2));
}

function resolveUrgencyBonus(sla: DispatchSlaPolicy): number {
  const byLevel: Record<string, number> = { LOW: 0, NORMAL: 0, HIGH: 1, CRITICAL: 2 };
  const fromLevel = byLevel[String(sla.urgency_level ?? "NORMAL").toUpperCase()] ?? 0;
  const accept = Number(sla.accept_minutes ?? 0);
  if (Number.isFinite(accept) && accept > 0 && accept <= 10) return Math.max(fromLevel, 2);
  if (Number.isFinite(accept) && accept > 0 && accept <= 30) return Math.max(fromLevel, 1);
  return fromLevel;
}

export const skillMatchStrategy: DispatchDecisionStrategy = {
  name: "skill_match",
  evaluate(input) {
    const required = normalizeCaps(input.task.required_capabilities);
    const urgencyBonus = resolveUrgencyBonus(input.sla);
    const candidates = input.executors
      .map((executor) => {
        const caps = normalizeCaps(executor.capabilities);
        const missing = required.filter((x) => !caps.includes(x));
        if (missing.length > 0) {
          return {
            executor_id: executor.executor_id,
            priority: -999,
            reasons: [`skill_match:missing(${missing.join(",")})`],
          };
        }
        const base = 40 + required.length * 3 + urgencyBonus;
        return {
          executor_id: executor.executor_id,
          priority: base,
          reasons: [required.length ? `skill_match:all_required(${required.length})` : "skill_match:not_required"],
        };
      });
    return {
      candidates,
      explain: `skill_match evaluated ${input.executors.length} executors; required_caps=${required.length}`,
    };
  },
};

export const nearestDistanceStrategy: DispatchDecisionStrategy = {
  name: "nearest_distance",
  evaluate(input) {
    const taskLocation = input.task.location;
    const candidates = input.executors.map((executor) => {
      if (!taskLocation || !executor.location) {
        return {
          executor_id: executor.executor_id,
          priority: 0,
          reasons: ["nearest_distance:location_missing"],
        };
      }
      const km = distanceKm(taskLocation, executor.location);
      const bonus = Math.max(0, 30 - Math.trunc(km));
      return {
        executor_id: executor.executor_id,
        priority: bonus,
        reasons: [`nearest_distance:${km.toFixed(1)}km`],
      };
    });
    return {
      candidates,
      explain: `nearest_distance used task_location=${taskLocation ? "yes" : "no"}`,
    };
  },
};

export const loadBalanceStrategy: DispatchDecisionStrategy = {
  name: "load_balance",
  evaluate(input) {
    const maxLoad = Math.max(1, ...input.executors.map((x) => Math.max(0, Number(x.current_load ?? 0))));
    const candidates = input.executors.map((executor) => {
      const load = Math.max(0, Number(executor.current_load ?? 0));
      const bonus = Math.max(0, 30 - Math.round((load / maxLoad) * 30));
      return {
        executor_id: executor.executor_id,
        priority: bonus,
        reasons: [`load_balance:load=${load}`],
      };
    });
    return {
      candidates,
      explain: `load_balance normalized against max_load=${maxLoad}`,
    };
  },
};

const builtInStrategies: Record<string, DispatchDecisionStrategy> = {
  [skillMatchStrategy.name]: skillMatchStrategy,
  [nearestDistanceStrategy.name]: nearestDistanceStrategy,
  [loadBalanceStrategy.name]: loadBalanceStrategy,
};

export function composeDispatchDecisionStrategies(strategies: DispatchDecisionStrategy[]): DispatchDecisionStrategy {
  return {
    name: `composed(${strategies.map((x) => x.name).join("+")})`,
    evaluate(input) {
      const aggregate = new Map<string, DispatchCandidate>();
      const explainParts: string[] = [];
      for (const strategy of strategies) {
        const result = strategy.evaluate(input);
        explainParts.push(result.explain);
        for (const candidate of result.candidates) {
          const current = aggregate.get(candidate.executor_id) ?? { executor_id: candidate.executor_id, priority: 0, reasons: [] };
          current.priority += candidate.priority;
          current.reasons.push(...candidate.reasons);
          aggregate.set(candidate.executor_id, current);
        }
      }
      const candidates = Array.from(aggregate.values()).sort((a, b) => b.priority - a.priority || a.executor_id.localeCompare(b.executor_id));
      return {
        candidates,
        explain: explainParts.join(" | "),
      };
    },
  };
}

export function setDispatchStrategyConfig(entries: DispatchStrategyConfigEntry[]): void {
  runtimeDispatchStrategyConfig = (entries?.length ? entries : defaultDispatchStrategyConfig).map((x) => ({
    tenant_id: x.tenant_id,
    project_id: x.project_id,
    strategies: Array.isArray(x.strategies) && x.strategies.length ? x.strategies.map((s) => String(s).trim()).filter(Boolean) : [...DEFAULT_STRATEGY_NAMES],
  }));
}

export function resetDispatchStrategyConfig(): void {
  runtimeDispatchStrategyConfig = defaultDispatchStrategyConfig.map((x) => ({ ...x, strategies: [...x.strategies] }));
  runtimeConfigLoadedFromEnv = false;
}

export function listDispatchStrategyConfig(): DispatchStrategyConfigEntry[] {
  return runtimeDispatchStrategyConfig.map((x) => ({ ...x, strategies: [...x.strategies] }));
}

function entryWeight(entry: DispatchStrategyConfigEntry): number {
  const tenantScore = entry.tenant_id && entry.tenant_id !== "*" ? 2 : 0;
  const projectScore = entry.project_id && entry.project_id !== "*" ? 1 : 0;
  return tenantScore + projectScore;
}

function matchConfig(entry: DispatchStrategyConfigEntry, scope: TenantProjectScope): boolean {
  const tenantOk = !entry.tenant_id || entry.tenant_id === "*" || entry.tenant_id === scope.tenant_id;
  const projectOk = !entry.project_id || entry.project_id === "*" || entry.project_id === scope.project_id;
  return tenantOk && projectOk;
}

export function resolveDispatchStrategyNames(scope: TenantProjectScope): string[] {
  const matched = runtimeDispatchStrategyConfig.filter((x) => matchConfig(x, scope));
  if (!matched.length) return [...DEFAULT_STRATEGY_NAMES];
  matched.sort((a, b) => entryWeight(b) - entryWeight(a));
  return [...matched[0].strategies];
}

export function getDispatchDecisionStrategyForScope(scope: TenantProjectScope): DispatchDecisionStrategy {
  ensureDispatchStrategyConfigLoadedFromEnv();
  const strategyNames = resolveDispatchStrategyNames(scope);
  const strategies = strategyNames.map((name) => builtInStrategies[name]).filter(Boolean);
  const usable = strategies.length ? strategies : DEFAULT_STRATEGY_NAMES.map((name) => builtInStrategies[name]).filter(Boolean);
  return composeDispatchDecisionStrategies(usable);
}

export function decideDispatchCandidates(input: DispatchDecisionInput): DispatchDecisionOutput {
  const strategy = getDispatchDecisionStrategyForScope(input.scope);
  return strategy.evaluate(input);
}

export function ensureDispatchStrategyConfigLoadedFromEnv(): void {
  if (runtimeConfigLoadedFromEnv) return;
  runtimeConfigLoadedFromEnv = true;
  const raw = String(process.env.CONTROLPLANE_DISPATCH_STRATEGIES_JSON ?? "").trim();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const entries = parsed.map((entry: any) => ({
      tenant_id: typeof entry?.tenant_id === "string" ? entry.tenant_id : undefined,
      project_id: typeof entry?.project_id === "string" ? entry.project_id : undefined,
      strategies: Array.isArray(entry?.strategies) ? entry.strategies.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [],
    }));
    setDispatchStrategyConfig(entries);
  } catch {
    // ignore malformed env config, keep default strategy set.
  }
}
