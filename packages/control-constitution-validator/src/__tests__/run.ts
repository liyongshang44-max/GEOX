import { validateControlRuleSetV0 } from "../ruleset/control_ruleset_v0_validator"; // 引入：admission validator

import ok from "../../fixtures/ruleset_ok_001.json"; // 正向样例：必须通过
import badAction from "../../fixtures/ruleset_bad_action_001.json"; // 负向：未知 action_code
import badPath from "../../fixtures/ruleset_bad_path_001.json"; // 负向：inputs_used 含未知 path
import badTemplate from "../../fixtures/ruleset_bad_template_001.json"; // 负向：rule 使用未允许模板
import badImplicit from "../../fixtures/ruleset_bad_implicitdep_001.json"; // 负向：expr 引用未声明 inputs_used

// 额外：fixture-only 资产包 negative acceptance
import "./acceptance_rulesets_v0"; // 仅测试：禁止形成 runtime 加载语义

function expectOk(name: string, obj: unknown): void {
  validateControlRuleSetV0(obj); // 通过则不抛错
  console.log(`[OK] ${name}`); // 输出通过信息
}

function expectFail(name: string, obj: unknown): void {
  try {
    validateControlRuleSetV0(obj); // 预期抛错
  } catch (e) {
    console.log(`[FAIL-AS-EXPECTED] ${name}: ${(e as Error).message}`); // 输出失败原因
    return; // 失败符合预期
  }
  throw new Error(`expected fail but passed: ${name}`); // 未抛错则测试失败
}

expectOk("ruleset_ok_001", ok); // 正向：必须通过
expectFail("ruleset_bad_action_001", badAction); // 负向：必须失败
expectFail("ruleset_bad_path_001", badPath); // 负向：必须失败
expectFail("ruleset_bad_template_001", badTemplate); // 负向：必须失败
expectFail("ruleset_bad_implicitdep_001", badImplicit); // 负向：必须失败

console.log("control-constitution-validator tests ok"); // 总结输出
