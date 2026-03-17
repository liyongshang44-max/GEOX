Validation

1) agronomy positive E2E
Command:
node .\scripts\agronomy_acceptance\ACCEPTANCE_AGRONOMY_E2E_V1.cjs

Result:
PASS e2e acceptance (recommendation->approval->operation_plan->dispatch bridge->receipt->export) {
  recommendation_id: 'rec_f51dd65f7d8f46deb20e48b01ed4a64e',
  approval_request_id: 'apr_791b32763a254d5c9bdc10fd3a46f1c9',
  operation_plan_id: 'opl_894c7a71f3f24eaa864d842c7037a3d4',
  act_task_id: 'act_9fa00b1b650f4fe890d7fa437408a704',
  receipt_fact_id: 'c6b4473a-7ed2-4b41-a4be-bfc05b2d81bd',
  export_job_id: 'job_b511ecd1-42cf-4d46-ae96-9ecba125e27c'
}

2) agronomy negative security
Command:
node .\scripts\agronomy_acceptance\ACCEPTANCE_AGRONOMY_NEGATIVE_SECURITY_V1.cjs

Result:
PASS negative security acceptance

3) executor hardening negative
Command:
node .\scripts\ao_act_executor\ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1.cjs

Result:
PASS ACCEPTANCE_EXECUTOR_HARDENING_NEGATIVE_V1

4) server typecheck
Command:
pnpm --filter @geox/server typecheck

Result:
PASS

5) web typecheck
Command:
pnpm --filter @geox/web typecheck

Result:
PASS

这个 follow-up PR 只有在以下 4 条都成立时才算完成：

- 无 token 访问 recommendation list 返回 401
- 不存在 recommendation submit-approval 明确失败
- 未审批 recommendation 不能进入可执行链
- PR 描述中明确说明 recommendation 域不存在 direct execute / direct dispatch 路径
