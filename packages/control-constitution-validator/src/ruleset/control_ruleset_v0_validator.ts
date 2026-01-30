import { ControlRuleSetV0Z } from "./control_ruleset_v0_zod"; // 结构性 schema：先把形态封闭
import type { ControlRuleSetV0, TemplateExprV0 } from "./control_ruleset_v0_zod"; // 类型：便于遍历校验
import { assertValidAoActionCodeV0 } from "@geox/control-kernel"; // AO taxonomy 真源：来自已冻结的 control-kernel
import { assertAllowedInputPathV0 } from "@geox/control-kernel"; // AllowedInputPaths 真源：来自已冻结的 control-kernel

function collectFieldPathsFromExpr(expr: TemplateExprV0, out: Set<string>): void {
  if (expr.template_id === "FIELD_EQ") out.add(expr.field_path); // FIELD_EQ 引用单字段
  else if (expr.template_id === "FIELD_IN") out.add(expr.field_path); // FIELD_IN 引用单字段
  else if (expr.template_id === "FIELD_EXISTS") out.add(expr.field_path); // FIELD_EXISTS 引用单字段
  else if (expr.template_id === "SET_INTERSECTS") out.add(expr.field_path); // SET_INTERSECTS 引用单字段
  else if (expr.template_id === "WINDOW_MATCH") return; // WINDOW_MATCH 不引用 field_path（避免策略化扩展）
  else if (expr.template_id === "LOGICAL_AND") expr.children.forEach((c: TemplateExprV0) => collectFieldPathsFromExpr(c, out)); // AND 递归收集
  else if (expr.template_id === "LOGICAL_OR_NOT" && expr.op === "OR")
    expr.children.forEach((c: TemplateExprV0) => collectFieldPathsFromExpr(c, out)); // OR 递归收集
  else if (expr.template_id === "LOGICAL_OR_NOT" && expr.op === "NOT") collectFieldPathsFromExpr(expr.child, out); // NOT 递归收集
}

function ensureKnownActionCode(actionCode: string): void {
  try {
    assertValidAoActionCodeV0(actionCode, "control_ruleset_v0.action_code"); // taxonomy: throw on unknown
  } catch {
    throw new Error(`action_code not in AO taxonomy v0: ${actionCode}`); // 归一化错误信息
  }
}

function ensureAllowedInputPath(path: string): void {
  try {
    assertAllowedInputPathV0(path, "control_ruleset_v0.inputs_used[]"); // allowlist: throw on unknown
  } catch {
    throw new Error(`inputs_used contains disallowed path: ${path}`); // 归一化错误信息
  }
}

export function validateControlRuleSetV0(input: unknown): ControlRuleSetV0 {
  const parsed = ControlRuleSetV0Z.parse(input); // 第一关：结构形态严格 parse（禁止额外字段/未知模板）

  ensureKnownActionCode(parsed.action_code); // 第二关：action_code 必须属于 AO taxonomy

  const inputsUsedSet = new Set<string>(); // inputs_used 集合：用于快速判定
  for (const p of parsed.inputs_used) {
    ensureAllowedInputPath(p); // 第三关：inputs_used 逐项必须属于 AllowedInputPaths
    inputsUsedSet.add(p); // 记录：用于 expr 引用检查
  }

  const allowedTemplateSet = new Set(parsed.allowed_template_ids); // ruleset 级模板白名单：用于快速判定
  for (const r of parsed.rules) {
    if (!allowedTemplateSet.has(r.template_id)) {
      throw new Error(`rule.template_id not allowed by ruleset: ${r.template_id}`); // 第四关：rule 使用模板必须在 ruleset.allowed_template_ids 内
    }
    if (r.template_id !== r.expr.template_id) {
      throw new Error(`rule.template_id must match expr.template_id: ${r.template_id} vs ${r.expr.template_id}`); // 防止“挂羊头卖狗肉”式偷渡
    }

    const referenced = new Set<string>(); // 收集该 rule expr 引用的字段集合
    collectFieldPathsFromExpr(r.expr as TemplateExprV0, referenced); // 遍历模板表达式，收集 field_path

    for (const fp of referenced) {
      if (!inputsUsedSet.has(fp)) {
        throw new Error(`expr references field_path not declared in inputs_used: ${fp}`); // 第五关：expr 引用字段必须在 inputs_used 内（禁止隐式依赖）
      }
    }
  }

  return parsed; // 通过所有 admission 校验后，返回强类型 ruleset
}

export function isControlRuleSetV0(input: unknown): input is ControlRuleSetV0 {
  try {
    validateControlRuleSetV0(input); // 用 validate 做强校验
    return true; // 全部通过则为真
  } catch {
    return false; // 任意失败则为假
  }
}
