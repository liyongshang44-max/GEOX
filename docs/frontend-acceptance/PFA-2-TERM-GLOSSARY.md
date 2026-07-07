<!-- docs/frontend-acceptance/PFA-2-TERM-GLOSSARY.md -->
# PFA-2 Term Glossary

## 1. Purpose

This glossary freezes product-facing zh-CN / en-US terminology for PFA-2. It governs display copy only and does not redefine backend enums, contracts, or data values.

## 2. Shared product states

| semantic key | zh-CN | en-US | boundary note |
|---|---|---|---|
| available | 可用 | Available | display state only |
| unavailable | 不可用 | Unavailable | safe product state |
| blocked | 已阻断 | Blocked | no execution implication |
| readOnly | 只读 | Read-only | review only |
| notConnected | 未连接 | Not connected | no live-device claim |
| notOnline | 未上线 | Not online | no production-gateway claim |
| notStarted | 未开始 | Not started | no field-pilot claim |
| disabled | 已禁用 | Disabled | capability remains off |
| degraded | 降级 | Degraded | display capability reduced |
| stale | 已过期 | Stale | freshness state only |
| unknown | 未知 | Unknown | safe unknown state |
| sourceMissing | 来源缺失 | Source missing | source is not available |
| evidenceUnavailable | 证据不可用 | Evidence unavailable | evidence not available |
| loading | 正在加载 | Loading | transient state |
| error | 暂不可用 | Temporarily unavailable | safe fallback, not raw error |
| permissionLimited | 权限受限 | Permission limited | access boundary only |

## 3. Customer terminology

| zh-CN | en-US |
|---|---|
| 经营总览 | Operating Overview |
| 授权范围 | Authorized Scope |
| 地块报告 | Field Report |
| 作业报告 | Operation Report |
| 报告条目 | Report Entries |
| 地块报告条目 | Field Report Entries |
| 作业进展 | Operation Progress |
| 验收状态 | Acceptance Status |
| 交付报告 | Deliverable Report |
| 导出交付 | Export Delivery |
| 暂无报告摘要 | No report summary available |
| 暂无摘要 | No summary available |

Customer copy must not introduce dispatch, approval, fact writes, AO-ACT, evidence mutation, or production-control capability.

## 4. Operator terminology

| zh-CN | en-US |
|---|---|
| 运行总览 | Runtime Overview |
| 地块运行视图 | Field Runtime |
| 源索引清单 | Source Index Inventory |
| 当前状态 | Current State |
| 预测 | Forecast |
| 情景 | Scenario |
| 残差 | Residual |
| 校准 | Calibration |
| 健康 | Health |
| 审计 | Audit |
| 回放支撑 | Replay-backed |
| 只读回查 | Read-only Readback |
| 不直接执行 | No Direct Execution |
| 不下发 | No Dispatch |
| 实时设备未连接 | Live Device Not Connected |
| 生产网关未上线 | Production Gateway Not Online |
| 田间试点未开始 | Field Pilot Not Started |

The English and Chinese forms must preserve identical review-only and non-execution semantics.

## 5. Admin terminology

| zh-CN | en-US |
|---|---|
| 后台管理 | Admin Console |
| 内部治理 | Internal Governance |
| 治理回查 | Governance Readback |
| 清单 | Inventory |
| 来源证据 | Source Evidence |
| 健康回查 | Health Readback |
| 技能 / 配置回查 | Skills / Config Readback |
| 非生产控制 | Not Production Control |
| 非服务操作 | Not a Service Action |
| 非实时监控 | Not Live Monitoring |

PFA-2 establishes display capability for known, unknown, unavailable, stale, and degraded. The Admin Devices status data contract remains owned by PFA-5.

## 6. Export and print terminology

| zh-CN | en-US |
|---|---|
| 报告导出 | Report Export |
| 打印视图 | Print View |
| 导出范围 | Export Scope |
| 生成时间 | Generated At |
| 页脚说明 | Footer Note |
| 状态 | Status |
| 摘要 | Summary |
| 明细 | Details |

PFA-2 localizes export/print copy only. Responsive layout, table reflow, wrapping, and print-only strategy remain PFA-4.

## 7. Authentication error mapping

| semantic code | zh-CN | en-US |
|---|---|---|
| MISSING_TOKEN | 请输入访问 Token 后再登录。 | Enter an access token before signing in. |
| INVALID_TOKEN | Token 无效或已过期，请检查后重试。 | The token is invalid or expired. Check it and try again. |
| MISSING_CONTEXT | 登录成功但缺少访问上下文，请联系管理员。 | Sign-in succeeded, but the access context is missing. Contact an administrator. |
| INSUFFICIENT_SCOPE | 当前 Token 权限不足，无法访问控制台。 | This token does not have sufficient scope to access the console. |
| SERVICE_UNREACHABLE | 认证服务暂时不可达，请稍后重试。 | The authentication service is temporarily unreachable. Try again later. |
| AUTH_REVOKED | 登录凭据已撤销，请重新登录。 | The sign-in credential was revoked. Sign in again. |
| AUTH_SCOPE_DENIED | 当前身份无权访问该范围，请联系支持人员。 | This identity cannot access the requested scope. Contact support. |
| AUTH_ROLE_DENIED | 当前角色无权访问该界面，请联系支持人员。 | This role cannot access the requested surface. Contact support. |
| AUTH_MISSING | 未检测到有效登录，请重新登录。 | No valid session was found. Sign in again. |
| AUTH_INVALID | 登录状态已失效，请重新登录。 | The session is no longer valid. Sign in again. |
| SERVICE_UNAVAILABLE | 认证服务暂不可用，请稍后重试。 | The authentication service is temporarily unavailable. Try again later. |
| UNKNOWN | 登录失败，请稍后再试或联系管理员。 | Sign-in failed. Try again later or contact an administrator. |

Raw codes are mapping inputs and must not be rendered to the user.
