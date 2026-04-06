export const queryKeys = {
  dashboard: {
    summary: () => ["dashboard", "summary"] as const,
  },
  fields: {
    all: () => ["fields"] as const,
    list: () => ["fields", "list"] as const,
    detail: (fieldId: string) => ["fields", "detail", fieldId] as const,
  },
  devices: {
    all: () => ["devices"] as const,
    list: (token?: string) => ["devices", "list", token ?? "anonymous"] as const,
    detail: (deviceId: string) => ["devices", "detail", deviceId] as const,
  },
  operations: {
    all: () => ["operations"] as const,
    list: () => ["operations", "list"] as const,
    detail: (operationPlanId: string) => ["operations", "detail", operationPlanId] as const,
    trajectory: (taskId: string) => ["operations", "trajectory", taskId] as const,
  },
  programs: {
    all: () => ["programs"] as const,
    list: () => ["programs", "list"] as const,
    detail: (programId: string) => ["programs", "detail", programId] as const,
    scheduling: {
      conflicts: () => ["programs", "scheduling", "conflicts"] as const,
      hints: () => ["programs", "scheduling", "hints"] as const,
    },
  },
  evidence: {
    all: () => ["evidence"] as const,
    list: () => ["evidence", "list"] as const,
    exportJobs: () => ["evidence", "export-jobs"] as const,
  },
} as const;
