# views 目录迁移策略（临时兼容层）

- `src/views/*` 仅用于 **兼容壳**（re-export 到 `src/features/*/pages/*`），避免一次性迁移导致大范围冲击。
- 新业务页面必须放在 `src/features/<domain>/pages/*`。
- `src/app/routes/*` 禁止再直接引用 `../../views/*`（由 ESLint 与 CI 脚本校验）。

后续可在所有调用完成迁移后删除本目录中的兼容壳。
