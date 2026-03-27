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
