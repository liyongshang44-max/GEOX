# GEOX Fail-safe & Manual Takeover V1

- GEOX 在设备离线、执行失败、验收失败/不确定时必须进入 fail-safe，阻止自动推进。
- 设备离线判定基于 `device_status_index_v1.status` 与 `last_heartbeat_ts_ms`。
- receipt failed/error 触发 EXECUTION_FAILED fail-safe 与 manual takeover。
- acceptance FAIL/PARTIAL 触发 ACCEPTANCE_FAILED/ACCEPTANCE_INCONCLUSIVE。
- OPEN fail-safe 必须阻止重复自动执行（task/dispatch）。
- 人工接管状态机：REQUESTED -> ACKED/IN_PROGRESS -> COMPLETED（可 CANCELLED）。
- resolve 需明确责任人并写审计。
- skill 不能绕过 fail-safe，legacy dispatch 同样受保护。
