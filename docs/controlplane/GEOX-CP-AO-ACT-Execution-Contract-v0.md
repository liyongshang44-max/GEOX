\# GEOX · Sprint 10

\# AO-ACT v0 — 执行传输合同（Step 3 · 冻结候选）



Status: Draft (Pending Freeze)  

Scope: Sprint 10 only  

Applies to: Control Plane (System-wide)  

Ownership: Governance-level (not owned by Apple II / Judge)



本规范仅定义“执行传输与审计合同”，不定义任何决策权威；不定义行动是否正确/合理/有效/是否符合农技。



---



\## 1. 目标（不可争议）



Sprint 10 · Step 3 的唯一目标是：



在不引入任何农技判断、不引入自动化决策、不消费 ProblemState 的前提下，冻结 AO-ACT v0 的执行传输合同，使其可实现、可验收、可长期承载。



AO-ACT v0 只回答一件事：



谁，在什么约束下，执行了什么物理动作，是否按约束完成。



---



\## 2. 冻结边界 / 禁止事项（违反任一条即 Sprint 10 失败）



1\) AO-ACT 不得包含任何农技、策略、价值判断语义。  

2\) AO-ACT task 不得由 ProblemState 自动生成或触发。  

3\) AO-ACT task creation 不得存在任何隐式、派生、模板化或默认生成路径。  

4\) AO-ACT 不得消费 ProblemState / Index / Agronomy 输出。  

5\) AO-ACT 不得形成 receipt → 下一任务 的自动闭环。  

6\) AO-ACT 不得修改或删除任何既有事实（append-only 不变）。  

7\) 不修改 ProblemStateV1 schema。  

8\) 不修改 Sprint 9 ProblemState Lifecycle 规则。  

9\) UI 不得提供自动执行或“一键下发”等改变语义的能力。



---



\## 3. AO-ACT Task（行动任务）



\### 3.1 语义定位（冻结）



AO-ACT task 是一个由人类显式创建的、物理可验证的执行指令声明。



它：

\- 描述“要执行什么动作”

\- 不描述“为什么要做”

\- 不表达成功期望或价值判断

\- 只表达执行设定与约束



\### 3.2 标识与授权（冻结）



act\_task\_id：

\- 系统生成

\- read-only

\- immutable

\- 全局唯一



issuer（任务发起者）：

\- 必须为显式的人类身份

\- 不允许为 system / judge / decide / agent / null



冻结判定规则：

\- issuer 的合法性仅基于身份类型 / namespace 判断

\- 禁止引入任何：可信度评分、权限等级评分、动态信任分数



Sprint 10 v0 中不存在“权限足够/不足”的语义，只有“是否为人类显式发起”。



\### 3.3 action\_type（冻结）



action\_type 必须来自 Sprint 10 已冻结的 allowlist（v0）。



本 Sprint 的最小集合为（已确认）：

PLOW / HARROW / SEED / SPRAY / IRRIGATE / TRANSPORT / HARVEST



任何不在 allowlist 内的 action\_type 必须被拒绝。



\### 3.4 parameters 与 constraints（关键边界）



parameters（执行设定值）：

\- 描述 executor 试图达到的执行设定目标

\- 仅允许：scalar / numeric / enumerated physical values

\- 必须可被物理验证（深度、剂量、速度、时长等）

\- 必须与 action\_type 强绑定

\- 必须存在工程安全上限（safety bounds）



明确禁止：

\- composite 参数（object/array）

\- named profiles / presets

\- semantic modes（aggressive / conservative 等）

\- 任何隐含策略或阶段语义



constraints（执行约束边界）：

\- 描述执行过程中不得违反的最大/最小边界

\- 不允许“目标性约束”（例如“达到效果”）



冻结语义区分：

\- parameters：期望的执行设定值

\- constraints：允许执行的边界范围



\### 3.5 Task 禁止字段（负面合同，冻结）



AO-ACT task 不得包含（任意层级）：

\- problem\_state\_id / lifecycle\_state

\- expected\_outcome / effectiveness / quality / desirability

\- next\_action / follow\_up

\- recommendation / suggestion / proposal

\- 农艺理由或建议



---



\## 4. AO-ACT Receipt（执行回执）



\### 4.1 语义定位（冻结）



AO-ACT receipt 是一个关于“执行实际发生了什么”的事实声明。



它：

\- 只描述执行行为

\- 不评价结果好坏

\- 不推导任何结论

\- 不产生后续动作建议



\### 4.2 Receipt 最小字段（冻结）



Receipt 至少必须包含：

\- task\_id（指向 AO-ACT task）

\- executor\_id（人 / 设备 / 脚本）

\- execution\_time（start/end）

\- execution\_coverage（空间/路径/区域）

\- resource\_usage（字段必须存在，值可为 null）

\- logs\_refs（原始日志或遥测指针）



\### 4.3 status 字段（v0 冻结）



status 若存在：

\- 仅允许表达“执行是否发生”

\- 推荐最小枚举：executed / not\_executed

\- 明确禁止：SUCCESS/FAILED/PARTIAL/ABORTED 等评价性枚举

\- 禁止任何隐含质量/效果/合理性的编码



---



\## 5. Receipt 校验责任（冻结）



Receipt 必须同时对两点负责：

1\) parameters 实际执行值的记录

2\) execution constraints 是否被违反的校验结果



Receipt 不负责：

\- 判断是否值得执行

\- 判断是否符合农艺

\- 判断是否应再次执行



---



\## 6. AO-ACT Index（派生索引）



\- 只读派生

\- 可重算

\- 不回写 Ledger

\- 不得作为任何执行触发或控制输入（对 AO-ACT 及任何其他行动系统均成立）



---



\## 7. 明确非目标（冻结）



AO-ACT v0 明确不解决：

\- 行动是否正确

\- 行动是否高效

\- 行动是否符合农艺最佳实践

\- 行动是否应被自动触发



（以上必须通过新版本号 + 新 acceptance 才能引入）



