export type CombineStrategyV0 = "DENY_OVERRIDES" | "FIRST_MATCH"; // 规则组合策略：v0 只允许两种
export type VerdictV0 = "ALLOW" | "DENY" | "UNDETERMINED"; // 裁决三值：与 ControlVerdict v0 对齐

export type TemplateIdV0 =
  | "FIELD_EQ" // 字段等于某枚举值
  | "FIELD_IN" // 字段属于枚举集合
  | "FIELD_EXISTS" // 字段存在性
  | "SET_INTERSECTS" // 字段集合与枚举集合有交集
  | "WINDOW_MATCH" // window 结构一致性
  | "LOGICAL_AND" // 与组合
  | "LOGICAL_OR_NOT"; // 或/非组合

export type TemplateExprV0 =
  | { template_id: "FIELD_EQ"; field_path: string; value: string } // EQ(field, value)
  | { template_id: "FIELD_IN"; field_path: string; values: string[] } // IN(field, set)
  | { template_id: "FIELD_EXISTS"; field_path: string } // EXISTS(field)
  | { template_id: "SET_INTERSECTS"; field_path: string; values: string[] } // INTERSECTS(fieldSet, set)
  | { template_id: "WINDOW_MATCH" } // WINDOW_MATCH(window) ——不含参数，避免策略化
  | { template_id: "LOGICAL_AND"; children: TemplateExprV0[] } // AND(children...)
  | { template_id: "LOGICAL_OR_NOT"; op: "OR"; children: TemplateExprV0[] } // OR(children...)
  | { template_id: "LOGICAL_OR_NOT"; op: "NOT"; child: TemplateExprV0 }; // NOT(child)

export type ControlRuleV0 = {
  rule_id: string; // 稳定标识：用于审计与版本治理
  rule_version: string; // SemVer：用于冻结与回溯
  template_id: TemplateIdV0; // 使用模板：必须在 ruleset.allowed_template_ids 中
  expr: TemplateExprV0; // 模板表达式：形态封闭，避免阈值/数值/文本
  verdict: VerdictV0; // 命中后输出的裁决三值
};

export type ControlRuleSetV0 = {
  type: "control_ruleset_v0"; // 类型判别符：冻结
  schema_version: string; // SemVer：ruleset schema 版本
  ruleset_id: string; // 稳定 id：用于审计与引用
  action_code: string; // 行动码：必须属于 AO taxonomy
  combine_strategy: CombineStrategyV0; // 组合策略：v0 二选一
  default_verdict: "UNDETERMINED"; // v0 强制：避免把未知偷换成禁止
  inputs_used: string[]; // 字段路径：必须全部属于 AllowedInputPaths
  allowed_template_ids: TemplateIdV0[]; // 模板白名单：ruleset 级约束
  rules: ControlRuleV0[]; // 规则列表：仅承载模板 + verdict，无其它语义
};
