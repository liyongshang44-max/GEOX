 GEOX 项目 · 开发与运行说明（冻结版 v1）

⸻

## 一、项目状态说明（重要）

当前仓库处于【可运行、可复现、可持续开发】状态：

• 后端（Server / Judge）可通过 Docker 启动  
• 前端（Web）可通过 Vite 启动  
• 数据库统一使用 Postgres  
• pnpm workspace 已稳定  
• 依赖 / 构建产物 / 运行态数据 均不进入仓库  

---

## 二、系统阶段裁定（给非工程人员）

GEOX 已不再是“验证能力是否存在”的原型系统。

当前系统已经完成并冻结了以下层级：

• 事实账本（Facts）：唯一事实来源  
• Judge：不确定性组织层（不做决策）  
• Agronomy：解释层（Explain-only）  
• Decision Plan：决策存在化（不可执行）  
• AO-ACT：执行与审计（不决策）  

系统已进入 **基础设施完成期（Governance-first phase）**。

---

## 三、冻结里程碑索引（重要）

本仓库所有不可逆的工程事实，统一收录于治理索引：

👉 **`docs/controlplane/INDEX.md`**

其中明确列出了：

• Sprint 10 · AO-ACT v0  
• Sprint 14 · Agronomy Interpretation v1  
• Sprint 16 · Decision Plan v0（非执行、非耦合）  

任何新增功能 **不得破坏索引中已冻结的语义边界**。

---

## 四、Judge v1 边界（冻结结论）

Judge v1 是证据组织与请求层（Evidence Orchestration Layer），而不是质量判定器：

• Judge v1 不断言数据充分性  
• 不给出最终质量结论  
• 所有 Judge 输出均为瞬时推导结果，不做数据库持久化  
• problem_type / summary / confidence 在 v1 中允许为空  
• 默认行为是在证据不足时发出 AO-SENSE: VERIFY  

---

## 五、环境要求

必须组件：

• Node.js ≥ 20  
• Docker Desktop（包含 docker compose）  
• pnpm（通过 corepack）  
• Windows PowerShell  

版本确认：

```bash
node -v
docker -v
docker compose version
六、仓库约定（非常重要）
本仓库【不包含】以下内容（这是正确状态）：

• node_modules
• dist / build
• *.sqlite / *.wal / *.shm
• 任何运行期生成的数据

上述内容必须在本地或容器内生成，不允许提交到仓库。

七、初始化与依赖安装
启用 pnpm

corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v
安装 workspace 依赖

pnpm install
八、启动后端（Postgres + Server）
docker compose up --build server
成功标志：

Server listening on http://0.0.0.0:3000

端口说明（避免混淆）：

- **宿主机入口**：`http://127.0.0.1:3001`
- **容器内调用**：`http://server:3000`（容器间通信保持不变）

### OpenAPI 与 Simulator 接口文档（新增）

- OpenAPI JSON 入口：`GET /api/v1/openapi.json`  
  本地可直接访问：`http://127.0.0.1:3001/api/v1/openapi.json`
- Device Simulator 新路由文档：`docs/DEVICE_OBSERVATION_AND_SIMULATION_V1.md` 的
  [6. Device Simulator 路由（V1）](docs/DEVICE_OBSERVATION_AND_SIMULATION_V1.md#device-simulator-v1-routes)
- 迁移说明：同文档
  [6.4 从 /api/v1/simulator-runner/* 迁移](docs/DEVICE_OBSERVATION_AND_SIMULATION_V1.md#migration-from-legacy-simulator-runner)

九、数据库初始化（Groups）
public.groups 是 group 的唯一事实来源。

（略，保持你原文）

十、启动前端（Web）
pnpm --filter @geox/web dev
访问：

http://localhost:5173

十一、验收真值定义（冻结）
• projectId = P_DEFAULT
• groupId = G_CAF
• sensor_id = CAF009

Judge 的评估对象始终是 group。

十二、工程约束（冻结）
必须遵守：

• pnpm workspace
• Postgres 为唯一数据库

明确禁止：

• 提交构建产物
• 使用 docker compose down -v

十三、当前结论（冻结）
• 系统已完成基础设施阶段
• 语义边界已通过 negative acceptance 锁死
• 后续演进以治理优先于功能


十四、执行入口约束（新增）
• recommendation 没有执行权；用户界面、recommendation 域和审批提交流程不得直接调用执行入口。
• 执行入口仅供 executor runtime 在已批准 task 上调用。
• 宪法级约束：执行只能通过 approval → AO-ACT task → executor，任何 recommendation 不能直接触发执行。

十五、P1 smoke 分层定义（skills -> operation -> receipt/evidence -> operation_state）
------------------------------------------------------------

### 1) 脚本定位（必须区分）

- `p1_skill_loop_minimal.mjs` = **链路 smoke**（只验证链路连通与状态机基础约束）。
- `p1_skill_loop_acceptance_smoke.mjs` = **验收完成 smoke**（验证“执行完成 + 验收完成”的最终闭环）。

### 2) 通过标准（必须区分）

- **链路 smoke 通过 ≠ 验收最终通过**。
  - `p1_skill_loop_minimal.mjs` 通过，只能说明：技能绑定、operation 创建、receipt/evidence 入链、状态投影等主链路可达。
  - 在 success lane 中，`final_status=PENDING_ACCEPTANCE` 也算链路 smoke 的“正常通过”。
- **验收 smoke 通过 = 闭环进入最终成功态**。
  - `p1_skill_loop_acceptance_smoke.mjs` 通过，才代表验收结论已落地，闭环进入最终成功态（例如 PASS/SUCCESS 等验收后终态）。

### 3) `p1_skill_loop_minimal.mjs` 运行方式

用于最小联调闭环脚本（同一租户上下文下，一条 success-mapped、一条 INVALID_EXECUTION）：

```bash
node apps/server/scripts/p1_skill_loop_minimal.mjs
```

命名说明（避免与验收 smoke 混淆）：

- `p1_skill_loop_minimal.mjs`：业务链路 smoke（会真实调用接口并校验状态）。
- 若新增“源码一致性/结构自检”脚本，请使用 `*_selfcheck.mjs` 命名，不使用 `*_acceptance*.mjs`，避免与业务 smoke 混淆。

可选环境变量（默认值如下）：

- `GEOX_BASE_URL`（默认 `http://127.0.0.1:3001`）
- `GEOX_TOKEN`（默认使用 `config/auth/ao_act_tokens_v0.json` 中 tenantA 的开发 token）
- `GEOX_TENANT_ID`（默认 `tenantA`）
- `GEOX_PROJECT_ID`（默认 `projectA`）
- `GEOX_GROUP_ID`（默认 `groupA`）

脚本会执行以下串联：

1. `POST/GET /api/v1/skills/bindings`
2. `POST /api/v1/operations/manual` 创建两条 operation
3. `POST /api/control/ao_act/receipt` 分别写入正式证据（runtime log）与无效证据（sim_trace）
4. `GET /api/v1/operations` 查询最终 `final_status`

最终断言（链路 smoke 口径）：

- 至少 1 条 `final_status` 命中 success 映射：`PENDING_ACCEPTANCE|SUCCESS|SUCCEEDED|VALID`
- 至少 1 条 `final_status=INVALID_EXECUTION`

### 4) 示例输出（链路 smoke 正常通过，且 success lane 为 `PENDING_ACCEPTANCE`）

```text
[p1-smoke][success][waitFinal] {
  attempt: 1,
  operationPlanId: 'op_20260411_001',
  finalStatus: 'PENDING_ACCEPTANCE'
}
[p1-smoke] done {
  success: {
    operation_plan_id: 'op_20260411_001',
    final_status: 'PENDING_ACCEPTANCE',
    success_mapped_by: 'PENDING_ACCEPTANCE'
  },
  invalid: {
    operation_plan_id: 'op_20260411_002',
    final_status: 'INVALID_EXECUTION'
  }
}
[p1-smoke] done [ 'PENDING_ACCEPTANCE', 'INVALID_EXECUTION' ]
```

> 解释：该输出表示“链路 smoke 已通过”，但 success lane 仍处于待验收；这**不是**“验收最终通过”。
