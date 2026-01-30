import { z } from "zod"; // zod：运行时 schema 校验（admission control 的基础）

const SemVerZ = z.string().regex(/^\d+\.\d+\.\d+$/); // SemVer：避免自由文本版本

export const TemplateIdV0Z = z.enum([
  "FIELD_EQ",
  "FIELD_IN",
  "FIELD_EXISTS",
  "SET_INTERSECTS",
  "WINDOW_MATCH",
  "LOGICAL_AND",
  "LOGICAL_OR_NOT"
] as const); // 模板集合：v0 冻结，拒绝未知模板

export const VerdictV0Z = z.enum(["ALLOW", "DENY", "UNDETERMINED"]); // 三值裁决：与宪法一致

// 注意：TemplateExprV0 里 template_id=LOGICAL_OR_NOT 有两个分支（OR/NOT），不能用 discriminatedUnion("template_id")。
// 这里用 z.union 以保持形态封闭，同时不引入新的 discriminator 字段。
export const TemplateExprV0Z: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z
      .object({
        template_id: z.literal("FIELD_EQ"),
        field_path: z.string().min(1),
        value: z.string().min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("FIELD_IN"),
        field_path: z.string().min(1),
        values: z.array(z.string().min(1)).min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("FIELD_EXISTS"),
        field_path: z.string().min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("SET_INTERSECTS"),
        field_path: z.string().min(1),
        values: z.array(z.string().min(1)).min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("WINDOW_MATCH")
      })
      .strict(),
    z
      .object({
        template_id: z.literal("LOGICAL_AND"),
        children: z.array(TemplateExprV0Z).min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("LOGICAL_OR_NOT"),
        op: z.literal("OR"),
        children: z.array(TemplateExprV0Z).min(1)
      })
      .strict(),
    z
      .object({
        template_id: z.literal("LOGICAL_OR_NOT"),
        op: z.literal("NOT"),
        child: TemplateExprV0Z
      })
      .strict()
  ])
); // TemplateExpr：形态封闭，天然禁止数值比较/阈值/计数/排序/文本匹配

export const ControlRuleV0Z = z
  .object({
    rule_id: z.string().min(1),
    rule_version: SemVerZ,
    template_id: TemplateIdV0Z,
    expr: TemplateExprV0Z,
    verdict: VerdictV0Z
  })
  .strict(); // Rule：禁止额外字段（防止偷渡解释/权重/优先级）

export const ControlRuleSetV0Z = z
  .object({
    type: z.literal("control_ruleset_v0"),
    schema_version: SemVerZ,
    ruleset_id: z.string().min(1),
    action_code: z.string().min(1),
    combine_strategy: z.enum(["DENY_OVERRIDES", "FIRST_MATCH"]),
    default_verdict: z.literal("UNDETERMINED"),
    inputs_used: z.array(z.string().min(1)).min(1),
    allowed_template_ids: z.array(TemplateIdV0Z).min(1),
    rules: z.array(ControlRuleV0Z).min(1)
  })
  .strict(); // RuleSet：同样禁止额外字段（防便利字段渗入）

export type ControlRuleSetV0 = z.infer<typeof ControlRuleSetV0Z>; // 推导 TS 类型：避免漂移
export type ControlRuleV0 = z.infer<typeof ControlRuleV0Z>; // 推导 TS 类型：用于实现层
export type TemplateExprV0 = z.infer<typeof TemplateExprV0Z>; // 推导 TS 类型：用于遍历校验
export type TemplateId = z.infer<typeof TemplateIdV0Z>; // 推导 TS 类型：模板 id
