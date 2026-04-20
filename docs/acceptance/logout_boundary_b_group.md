# B 组试点：退出链路边界说明

## 当前实现口径（方案 B）

当前前端退出行为定义为：

1. 清除本地 session（token + tenant/project/group + session meta）
2. 跳转到 `/login?reason=AUTH_MISSING`

对应代码入口：`apps/web/src/app/TopBar.tsx` 的“退出（本地会话）”按钮。

## 明确非目标

- 当前**未实现** external IdP / 企业身份平台联动退出。
- 当前退出语义**不等同于**企业级“全链路登出”（例如同时注销上游 SSO 会话）。

## 适用范围

- 仅用于 B 组试点主流程会话管理签收。
- 后续若接入统一 IAM，再升级为服务端/IdP 联动 logout（可另行切换到方案 A）。
