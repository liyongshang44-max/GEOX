GEOX-ControlConstitution-RepoConst-Ruleset-Layout-v0.md
文档状态

状态：Frozen

等级：Control Constitution

生效范围：RuleSet 资产结构与审计回放

1. 目的

本文档裁定 repo-const 中 RuleSet 资产的最小结构要求，以及
ruleset_ref 的生成与合法性标准。

2. Layout v0 总体原则

Layout 只为：

admission 校验

审计回放

不为：

runtime 加载

自动发现

执行优化

3. 最小资产包（Asset Bundle v0）

一个 RuleSet 资产包至少包含：

ruleset JSON 文件

schema_version

ruleset_id

allowed_template_ids

allowed_input_paths

AO action_code 绑定

资产包 只允许作为 fixture 或 repo-const 文件存在。

4. ruleset_ref 的角色裁定

ruleset_ref 是：

审计锚点

回放定位符

规则版本指针

它不是：

gating 输入

排序信号

触发条件

5. ruleset_ref 生成规则（冻结）

ruleset_ref 的生成必须满足：

可离线复算

与运行环境无关

与时间无关

与部署方式无关

🔒 不可误读补充条款 4（冻结）

ruleset_ref 的生成必须是确定性的、可复算的；
任何无法在离线条件下复算的 ref（如 branch / time / env）
视为无效 ref。

合法示例

git commit sha

git annotated tag

ruleset bundle content hash

非法示例（明确禁止）

当前分支名

构建时间戳

环境变量拼接值

runtime 注入 token

6. Layout 与 Runtime 的关系

Layout v0 的存在 不构成 runtime 行为依据。

即使 repo 中存在完整、合法的 RuleSet Layout：

runtime 行为仍等价于无规则

Kernel 不得感知其存在

系统行为不得发生变化

7. 版本升级原则

任何对 Layout 的扩展：

必须新建 v1 文档

不得回写 v0

不得通过“可选字段”绕过冻结

8. 结语（裁定）

Repo-Const RuleSet 的存在是治理与审计事实，
不是运行时能力来源。

一切试图把“规则存在”转化为“系统行为变化”的实现，
在 v0 下均视为违宪。