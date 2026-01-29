GEOX 项目 · 开发与运行说明（冻结版 v1）
零、GEOX 是什么（给非工程人员）

GEOX 不是一个“自动决策农业系统”，也不是一个“AI 控制农机系统”。

它是一个用于农业与土地系统的「事实、判断、执行」可审计骨架。

一句话理解：

GEOX 的目标不是替你做决定，
而是确保 每一次观测、判断、执行，都能被完整追溯、复现和审计。

GEOX 当前已经做到的事（冻结事实）
1️⃣ 观测是可信的

系统可以持续接收并保存来自传感器的原始观测数据与异常标记。
这些数据一旦写入，即不可修改、不可删除。

含义是：
任何人都可以回放过去任意时间点的真实观测状态。

2️⃣ 判断是不下结论的

系统中的 Judge 模块可以：

判断证据是否不足

判断证据是否冲突

明确指出还需要什么额外观测

但 Judge 不会给出：

好 / 坏结论

是否合格

是否应该执行某个动作

默认行为只有一种：

证据不足 → 请求更多观测

3️⃣ 执行是可审计的

系统已经支持：

显式下发操作任务

记录执行过程与执行结果

全链路留痕、可回溯

但系统 不会自动决定是否执行，
也 不会因为判断结果而自动触发行动。

4️⃣ 解释是被严格约束的

系统允许写入一种内容：Agronomy Interpretation（农业解释）。

它只能表达：

“基于这些证据，我们如何理解当前状态”

“发生了什么现象”

它被明确禁止用于：

提出行动建议

给出优先级

触发执行

进行收益或效果评估

一旦解释内容越界，系统会直接拒绝。

GEOX 当前明确不能做的事（同样是冻结事实）

以下行为在当前版本中是明确禁止的：

自动决策

自动执行

判断直接触发行动

用 AI 替代人的责任判断

如果系统中出现这些行为，那一定是 Bug 或违规扩展。

为什么要这样设计？

在农业、土地、资源系统中：

错误的自动化比慢更危险

不可追溯的智能判断风险极高

一旦闭环失控，责任无法界定

GEOX 的设计选择是：

先把事实、判断、执行彻底拆开，
再谈智能与自动化。

当前版本的定位

你现在看到的 GEOX：

不是 Demo

不是“最终自动化形态”

而是一个 长期可维护的安全基线

它确保未来无论系统如何智能化：

都能回答三个问题：
发生了什么？为什么？是谁决定的？

一、项目状态说明（重要）

当前仓库处于【可运行、可复现、可持续开发】状态：

后端（Server / Judge）可通过 Docker 启动

前端（Web）可通过 Vite 启动

数据库统一使用 Postgres

pnpm workspace 已稳定

依赖 / 构建产物 / 运行态数据 均不进入仓库

【冻结结论（Judge v1 边界）】

Judge v1 是证据组织与请求层（Evidence Orchestration Layer），而不是质量判定器：

Judge v1 不断言数据充分性

不给出最终质量结论

所有 Judge 输出均为瞬时推导结果，不做数据库持久化

problem_type / summary / confidence 在 v1 中允许为空

默认行为是在证据不足或语义未引入时，发出 AO-SENSE: VERIFY

二、环境要求

必须组件：

Node.js ≥ 20

Docker Desktop（包含 docker compose）

pnpm（通过 corepack）

Windows PowerShell（本文示例基于 PowerShell）

版本确认：

node -v
docker -v
docker compose version

三、仓库约定（非常重要）

本仓库【不包含】以下内容（这是正确状态）：

node_modules

dist / build

*.sqlite / *.wal / *.shm

任何运行期生成的数据

上述内容必须在本地或容器内生成，不允许提交到仓库。

四、初始化与依赖安装
1. 启用 pnpm
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v

2. 安装 workspace 依赖

说明：

使用 pnpm-workspace.yaml

@geox/* 包通过 workspace link

禁止使用 npm / yarn

pnpm install

五、启动后端（Postgres + Server）
docker compose up --build server


首次启动会：

创建 Postgres 数据卷

在容器内执行 pnpm install

启动 @geox/server（tsx watch）

成功标志：

Server listening on http://0.0.0.0:3000

六、数据库初始化（Groups）

Postgres 初始化后需要最小 groups 数据。

public.groups 是当前系统中 groups 的唯一事实来源。

初始化示例：

docker exec -it geox-postgres psql -U landos -d landos -c "
CREATE TABLE IF NOT EXISTS public.groups (
  group_id     text PRIMARY KEY,
  project_id   text NOT NULL,
  display_name text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.groups (group_id, project_id, display_name)
VALUES
  ('G_CAF', 'P_DEFAULT', 'CAF Group')
ON CONFLICT DO NOTHING;
"


说明：

Judge / UI 不通过事实推导 groups

groups 是稳定、显式配置对象

group 是逻辑聚合单元，不等同于 sensor

七、启动前端（Web）
pnpm --filter @geox/web dev


默认访问：

http://localhost:5173

八、前端操作说明（重要）

前端页面仅用于构造 Judge 请求：

不直接修改数据库

不修改 Judge 配置

不作为 SSOT

字段含义：

Project ID：项目标识

Group ID：传感器组

Scale：评估尺度（当前冻结为 group）

Window Days：历史回溯窗口

Dry Run：是否模拟执行（Judge 永远不落库）

九、验收真值定义（冻结）

固定验收组合：

projectId = P_DEFAULT

groupId = G_CAF

sensor_id = CAF009

语义说明：

Judge 的评估对象始终是 group

sensor 只是证据来源

十、Judge 使用说明（CLI）

接口：

POST /api/judge/run


PowerShell 示例（略，保持不变）。

十一、工程约束（冻结）

必须遵守：

pnpm workspace

Postgres 为唯一数据库

node_modules 不入仓库

明确禁止：

提交构建产物

docker compose down -v

十二、项目结构概览
GEOX/
├─ apps/
│  ├─ server/
│  ├─ web/
│  └─ judge/
├─ packages/
│  ├─ contracts/
│  └─ guardrails/
├─ config/judge/default.json
├─ docker-compose.yml
└─ README.md

十三、当前阶段结论（冻结）

基础设施：稳定

证据链路：可回放、可复现

Judge v1：边界明确，不做质量判定

group / sensor / project 语义清晰

该仓库是后续功能演进的可信基线版本。