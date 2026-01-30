import { z } from "zod"; // Zod 用于运行时 schema 校验（contracts 的工程真源）

const SemVerZ = z
  .string() // schema_version 使用字符串表达
  .regex(/^\d+\.\d+\.\d+$/); // 强制 SemVer 形态（避免自由文本）

const SubjectRefZ = z
  .object({
    projectId: z.string().optional(), // 项目维度（可选，取决于上游是否提供）
    groupId: z.string().optional(), // 组维度（可选）
    plotId: z.string().optional(), // 地块维度（可选）
    blockId: z.string().optional() // 子块维度（可选）
  })
  .strict(); // 禁止额外字段（防止语义漂移）

const WindowZ = z
  .object({
    startTs: z.number().int(), // 窗口起点：毫秒时间戳
    endTs: z.number().int() // 窗口终点：毫秒时间戳
  })
  .strict() // 禁止额外字段（防止便利字段渗入）
  .refine((v) => v.endTs > v.startTs, {
    message: "window.endTs must be > window.startTs" // 关系约束：避免反向窗口
  });

export const ControlVerdictV0Z = z
  .object({
    type: z.literal("control_verdict_v0"), // 类型判别符（冻结）
    schema_version: SemVerZ, // schema 版本（SemVer）
    verdict_id: z.string().min(1), // 全局唯一 id（形态约束：非空）
    evaluated_at_ts: z.number().int(), // 求值时间：毫秒时间戳
    subjectRef: SubjectRefZ, // 主体引用：只允许固定四字段
    window: WindowZ, // 时间窗：带 endTs > startTs 约束
    action_code: z.string().min(1), // 行动码：合法集合由 AO taxonomy enforce
    verdict: z.enum(["ALLOW", "DENY", "UNDETERMINED"]), // 三值裁决（冻结）
    rule_ref: z.string().optional(), // 可选：规则引用（仅审计）
    input_refs: z.array(z.string()).optional() // 可选：输入引用列表（仅审计）
  })
  .strict(); // 禁止任何额外字段（核心防线：不允许解释/排序/执行字段混入）

export type ControlVerdictV0 = z.infer<typeof ControlVerdictV0Z>; // TS 类型：由 schema 推导，避免手写漂移

export function parseControlVerdictV0(input: unknown): ControlVerdictV0 {
  return ControlVerdictV0Z.parse(input); // 运行时 parse：失败即抛错，用于 admission-control
}
