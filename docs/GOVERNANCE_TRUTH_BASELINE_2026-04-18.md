# GEOX 治理真相基线（2026-04-18）

> 目的：以 **GitHub main 当前真实仓库状态** 取代旧报告的阶段性判断，作为后续治理工作的单一基线。
>
> 结论口径分为：
> - **仍成立**：旧报告判断在当前 main 仍然有效
> - **部分成立**：方向对，但表述需要改写
> - **已过时**：当前 main 已实现或已修复，不能再当缺口描述
>
> 本文不讨论愿景，不讨论历史版本，只讨论当前主干事实。

---

## 1. 总判断

当前 GEOX 仓库已经不是“概念原型仓库”。

它的真实状态是：

- **控制平面主骨架已落地**
- **治理模块 MVP 可行**
- 后续治理重点应从“补存在性”切换为“补一致性、补商业交付边界、补对外能力面收口”

换句话说，当前阶段不应继续把仓库描述为“缺 operation / 缺 skill / 缺 operation_plan 的早期系统”；更准确的定义是：

> **一个已经具备远程农业控制平面主链能力、并开始向商业化收口的系统。**

---

## 2. 仍成立的旧报告判断

### 2.1 账户体系 / SaaS IAM 仍不足

当前虽然已有：

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/providers`

但默认认证模型仍以 token allowlist + scopes 为主，不是成熟的多租户用户目录 / 会话 / 组织权限体系。

**治理含义**：
这一项仍然是后续商业化最硬缺口之一。

### 2.2 Skill 不应直接按开放平台商品化承诺

当前 Skill registry / bindings / runs 已落地，但更完整的平台化能力仍未完全具备，例如：

- 商品化身份与权限
- 更完整的平台级编排与运营能力
- 更成熟的观测 / 回放 / 运维产品层

**治理含义**：
Skill 应继续按“内部治理中心 / 受控插件层”定位推进，而不是直接按“开放 marketplace”承诺。

### 2.3 Telemetry 外部能力面仍不理想

`telemetry_v1.ts` 当前已明确标注：

- deprecated
- replaced by `operation_state_v1 / program_v1`
- new flows 不应继续依赖

同时，其 `/api/v1/telemetry/*` 路径仍要求 `__internal__=true`，且查询主口径仍偏 `device_id`，而非 `field_id` 聚合主口径。

**治理含义**：
Telemetry 仍然更像兼容 / 内部查询面，而不是新产品主链。

### 2.4 若干 API 命名与蓝图仍不完全一致

例如：

- device-field 绑定当前主路径仍是 `/api/v1/devices/:device_id/bind-field`
- telemetry metrics 仍是设备级 summary，而非全系统 metrics catalog

**治理含义**：
当前问题更多是 API 产品化一致性问题，而不是主能力缺失问题。

---

## 3. 部分成立，但必须改写的旧报告判断

### 3.1 “双轨运行现实”仍存在，但不再是源码直跑 vs 构建产物

当前：

- 根 `docker-compose.yml` 已使用 dist/runtime
- `docker-compose.commercial_v1.yml` 也使用 dist/runtime

因此，旧报告若描述成“默认 compose 仍走 tsx 源码直跑”，则已失真。

更准确的表达应为：

> 当前仍存在“默认编排 vs commercial 编排”的交付层差异，但问题主要体现在编排完整度与交付范围，而不再是运行契约本身。

### 3.2 CI 已明显强于旧报告描述

当前 CI 已包含：

- build-test
- acceptance
- release-gate

而且 acceptance 直接使用 commercial compose 运行时。

因此不能再写成“CI 很轻，仅构建校验”。

更准确的表达应为：

> 当前已具备成型的工程级 CI + acceptance + release gate，但仍不等于成熟商业发布体系。

### 3.3 Commercial delivery baseline 已经存在

旧报告若表述为“私有化一键商用编排未到位”，在当前 main 上已不准确。

因为当前已有 `docker-compose.commercial_v1.yml`，且已纳入 CI/acceptance 主线。

更准确的表达应为：

> 商业最小编排基线已落地；真正仍需加强的是用户体系、运营面、交付模板与对外产品面一致性。

### 3.4 Field 域成熟度应上调

当前 Field 域已不是轻量 CRUD + GIS 雏形，而是相对完整的领域切面，包含：

- create / update / detail
- geometry / polygon
- seasons
- field detail summary
- bind-field
- device positions
- trajectories
- field sensing read models

因此旧报告若仍按“基础能力”描述，会低估当前实现进度。

---

## 4. 已过时、不得再当缺口描述的旧报告判断

### 4.1 “Auth API 只有 /auth/me，缺 login/logout” —— 已过时

当前 main 已实现：

- `/api/v1/auth/me`
- `/api/v1/auth/login`
- `/api/v1/auth/logout`
- `/api/v1/auth/providers`

### 4.2 “Fields 缺 PUT /api/v1/fields/:field_id” —— 已过时

当前 main 已实现 field update，且遵循 append-only fact + projection update 模式。

### 4.3 “缺少 skill_registry / skill_binding / skill_run” —— 已过时

当前 main 已实现：

- `skills_v1.ts`
- `skill_runs_v1.ts`
- facts + projections 支撑的 skills / bindings / runs 能力

### 4.4 “OperationPlan 领域未独立落地” —— 已过时

当前 main 已具备：

- `operation_plan_v1`
- `operation_plan_transition_v1`
- receipt 写回后更新 operation_plan 状态、metrics、actual_effect

### 4.5 “没有 /api/v1/operations/manual 主入口” —— 已过时

当前 main 已实现 `POST /api/v1/operations/manual`，并支持：

- `command_id` 幂等
- manual bootstrap
- `operation_plan -> approval -> AO-ACT` 启动链

### 4.6 “默认 compose 仅 postgres + server” —— 已过时

当前 main 根 compose 已不止这两项；commercial compose 更完整。

---

## 5. 当前应采用的仓库定义

后续所有治理与对外表述，建议统一使用如下口径：

> GEOX 当前是一个 **远程农业控制平面 commercial MVP**。
>
> 它已经具备：
> - operation plan / approval / AO-ACT / receipt / acceptance 主链
> - operation_state_v1 为核心的产品化读模型
> - skills / bindings / skill runs 模块治理底座
> - commercial compose + acceptance + release gate 交付骨架
>
> 它尚未完全具备：
> - 成熟多租户 SaaS 账户体系
> - 完整开放 Skill 平台商品化能力
> - 全面对外统一收口的 API 资源命名与产品能力面

---

## 6. 后续治理工作口径（冻结）

从本文起，后续治理不再按“补主骨架”推进，而按以下顺序推进：

1. **真相冻结**：以当前 main 为单一事实来源，不再让旧报告反向定义仓库缺口。
2. **能力面收口**：明确哪些 API 是主链、哪些是 compatibility only、哪些字段是外部合同。
3. **商业边界收口**：把 GEOX 对外定位固定为“远程农业控制平面 commercial MVP”，避免超前承诺。
4. **交付质量提升**：优先做账户体系、API 一致性、commercial 交付面、运营面，而不是重复补已有主链能力。

---

## 7. 一句话结论

当前 GEOX 的主要矛盾已经不是“有没有这些能力”，而是：

> **哪些能力已经存在但旧报告仍写成缺失，哪些能力仍是真正阻碍商业交付的缺口。**

后续治理必须围绕这个现实推进。
