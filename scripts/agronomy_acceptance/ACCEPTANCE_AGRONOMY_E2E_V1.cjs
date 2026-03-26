const { assert, env, fetchJson, requireOk } = require('./_common.cjs'); // Reuse shared acceptance helpers.

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); } // Small poll helper for async export jobs.

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001'); // Resolve API base URL from env.
  console.log(`[acceptance] BASE_URL=${base}`);
  const token = env('AO_ACT_TOKEN', ''); // Resolve AO-ACT bearer token from env.
  const tenant_id = env('TENANT_ID', 'tenantA'); // Resolve tenant id from env.
  const project_id = env('PROJECT_ID', 'projectA'); // Resolve project id from env.
  const group_id = env('GROUP_ID', 'groupA'); // Resolve group id from env.
  const field_id = env('FIELD_ID', 'field_demo_1'); // Resolve field id from env.
  const season_id = env('SEASON_ID', 'season_demo_1'); // Resolve season id from env.
  const device_id = env('DEVICE_ID', 'device_demo_1'); // Resolve device id from env.
  const cross_tenant_token = env('AO_ACT_TOKEN_TENANT_B', ''); // Optional real cross-tenant token for anti-enumeration validation.
  const export_window_before_ms = Number(env('EXPORT_WINDOW_BEFORE_MS', '3600000')) || 3600000; // Expand export window backward to capture full chain.
  const export_window_after_ms = Number(env('EXPORT_WINDOW_AFTER_MS', '120000')) || 120000; // Expand export window forward to tolerate async job timestamps.

  const recGen = await fetchJson(`${base}/api/v1/recommendations/generate`, { // Generate fresh recommendations for the acceptance chain.
    method: 'POST', token, // Send authenticated POST request.
    body: { // Provide deterministic recommendation inputs.
      tenant_id, project_id, group_id, // Bind request to one tenant triple.
      field_id, // Bind recommendation to the requested field.
      season_id, // Bind recommendation to the requested season.
      device_id, // Bind recommendation to the requested device.
      telemetry: { soil_moisture_pct: 20, canopy_temp_c: 33 }, // Trigger irrigation rule + heat stress rule.
      image_recognition: { stress_score: 0.55, disease_score: 0.75, pest_risk_score: 0.2, confidence: 0.9 } // Trigger crop health alert rule.
    }
  });
  const recJson = requireOk(recGen, 'generate'); // Assert generate returned ok.
  const recId = recJson.recommendations?.[0]?.recommendation_id; // Pick the first recommendation for the execution chain.
  assert.ok(recId, 'recommendation_id missing'); // Recommendation id must be present.

  const submit = await fetchJson(`${base}/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, { // Submit recommendation into approval + operation_plan bridge.
    method: 'POST', token, body: { tenant_id, project_id, group_id } // Carry tenant triple in the submit body.
  });
  const subJson = requireOk(submit, 'submit approval'); // Assert submit returned ok.
  assert.ok(subJson.approval_request_id, 'approval_request_id missing'); // Approval request id must be present.
  assert.ok(subJson.operation_plan_id, 'operation_plan_id missing'); // Operation plan id must be present.

  const planRead = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(subJson.operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { // Read operation plan immediately after submit.
    method: 'GET', token // Use authenticated GET request.
  });
  const planReadJson = requireOk(planRead, 'plan read after submit'); // Assert plan read returned ok.
  assert.strictEqual(planReadJson.item?.plan?.record_json?.payload?.status, 'CREATED', 'plan status should be CREATED before decide'); // Status must remain pending before approval decision.
  assert.strictEqual(String(planReadJson.item?.plan?.record_json?.payload?.act_task_id ?? ''), '', 'plan should not bind act_task_id before decide'); // Unapproved plan must not yet bind a task id.
  assert.strictEqual(planReadJson.item?.task, null, 'unapproved plan must not expose a task before decide'); // Unapproved plan must not resolve a task object.

  const crossTenantPlanRead = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(subJson.operation_plan_id)}?tenant_id=${encodeURIComponent('tenantB')}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { // Probe cross-tenant read using mismatched tenant triple.
    method: 'GET', token // Reuse the same token to validate non-enumerable mismatch handling.
  });
  assert.strictEqual(crossTenantPlanRead.status, 404, `expected 404 for cross-tenant plan read, got ${crossTenantPlanRead.status}`); // Cross-tenant plan reads must be hidden.

  const negativeBeforePublishBody = { // Build negative receipt body with missing task but valid contract fields.
    tenant_id, project_id, group_id, // Bind request to the valid tenant triple.
    task_id: 'act_missing_demo', // New receipt contract requires explicit task_id.
    act_task_id: 'act_missing_demo', // Preserve backward-compatible alias for current route shape.
    command_id: 'act_missing_demo', // Command id must match task id.
    device_id, // Reuse known device id for consistency.
    status: 'executed', // Simulate an executed receipt.
    meta: { idempotency_key: 'missing-task-uplink-demo' } // Provide required idempotency metadata.
  };

  const negativeBeforePublish = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, { // Probe receipt uplink before any task exists.
    method: 'POST', token, // Send authenticated POST request.
    body: negativeBeforePublishBody // Use explicit body object for easier debugging.
  });
  assert.strictEqual(negativeBeforePublish.status, 404, `expected 404 when uplinking missing task, got ${negativeBeforePublish.status}`); // Missing tasks must not be receipted.

  const decide = await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(subJson.approval_request_id)}/decide`, { // Approve the pending request to create the AO-ACT task.
    method: 'POST', token, // Send authenticated POST request.
    body: { tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'e2e bridge acceptance' } // Approve with deterministic reason text.
  });
  const decideJson = requireOk(decide, 'approval decide'); // Assert approval decision returned ok.
  const actTaskId = String(decideJson.act_task_id ?? ''); // Extract generated act_task_id as string.
  assert.ok(actTaskId, 'act_task_id missing after approve'); // Approved request must produce act_task_id.

  const dispatch = await fetchJson(`${base}/api/v1/ao-act/tasks/${encodeURIComponent(actTaskId)}/dispatch`, { // Explicitly dispatch the generated task.
    method: 'POST', token, // Send authenticated POST request.
    body: { tenant_id, project_id, group_id, adapter_hint: 'mqtt', device_id } // Request normalized mqtt adapter dispatch.
  });
  const dispatchJson = requireOk(dispatch, 'dispatch'); // Assert dispatch returned ok.
  assert.ok(dispatchJson.outbox_fact_id, 'outbox_fact_id missing'); // Dispatch must produce outbox_fact_id.

  const downlink = await fetchJson(`${base}/api/v1/ao-act/downlinks/published`, { // Simulate successful adapter publish.
    method: 'POST', token, // Send authenticated POST request.
    body: { // Publish payload matching the dispatched task.
      tenant_id, project_id, group_id, // Bind request to the tenant triple.
      act_task_id: actTaskId, // Reference the approved task.
      outbox_fact_id: dispatchJson.outbox_fact_id, // Bind publish audit to dispatch outbox fact.
      device_id, // Publish toward the expected device.
            topic: `/device/${device_id}/cmd`, // Use real-device command topic shape.
      payload: { cmd: 'execute' } // Minimal simulated command payload.
    }
  });
  requireOk(downlink, 'downlink published'); // Assert publish audit returned ok.

  const badUplinkBody = { // Build invalid device receipt body.
    tenant_id, project_id, group_id, // Bind request to the tenant triple.
    task_id: actTaskId, // New receipt contract requires explicit task_id.
    act_task_id: actTaskId, // Preserve backward-compatible alias for current route shape.
    command_id: actTaskId, // Command id must match task id.
    device_id: 'device_wrong', // Deliberately mismatch the device id.
    status: 'executed', // Simulate an executed receipt.
    meta: { idempotency_key: `bad-uplink-${actTaskId}` } // Provide required idempotency metadata.
  };

  const badUplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, { // Send one invalid receipt to validate device mismatch guard.
    method: 'POST', token, // Send authenticated POST request.
    body: badUplinkBody // Use explicit body object for easier debugging.
  });
  assert.strictEqual(badUplink.status, 404, `expected 404 for device mismatch uplink, got ${badUplink.status}`); // Device mismatch is non-enumerable and must be hidden as NOT_FOUND.
  assert.strictEqual(badUplink.json?.error, 'NOT_FOUND', 'expected NOT_FOUND'); // Error code must stay non-enumerable.

  if (cross_tenant_token) { // Optional runtime probe: use a real other-tenant token to validate object-level anti-enumeration.
    const crossTenantUplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, {
      method: 'POST', token: cross_tenant_token,
      body: {
        tenant_id, project_id, group_id, // Intentionally reference tenant A scope with tenant B token.
        task_id: actTaskId,
        act_task_id: actTaskId,
        command_id: actTaskId,
        device_id,
        status: 'executed',
        meta: { idempotency_key: `cross-tenant-uplink-${actTaskId}` }
      }
    });
    assert.strictEqual(crossTenantUplink.status, 404, `expected 404 for cross-tenant token uplink, got ${crossTenantUplink.status}`); // Cross-tenant probe must not leak existence.
    assert.strictEqual(crossTenantUplink.json?.error, 'NOT_FOUND', 'expected NOT_FOUND for cross-tenant token uplink'); // Keep error surface non-enumerable.
  } else {
    console.log('INFO skip cross-tenant token probe: AO_ACT_TOKEN_TENANT_B not set'); // Keep script runnable in single-tenant local environments.
  }

  const uplinkBody = { // Build valid receipt body.
    tenant_id, project_id, group_id, // Bind request to the tenant triple.
    task_id: actTaskId, // New receipt contract requires explicit task_id.
    act_task_id: actTaskId, // Preserve backward-compatible alias for current route shape.
    command_id: actTaskId, // Command id must match task id.
    device_id, // Match the published device id.
    status: 'executed', // Simulate successful execution.
    observed_parameters: {}, // Keep observed parameters explicit.
    meta: { idempotency_key: `receipt-${actTaskId}` } // Provide required idempotency metadata.
  };

  console.log('DEBUG uplink body', JSON.stringify(uplinkBody)); // Print actual uplink body to diagnose receipt contract issues.

  const uplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, { // Send the valid receipt uplink.
    method: 'POST', token, // Send authenticated POST request.
    body: uplinkBody // Use explicit body object for easier debugging.
  });
  const uplinkJson = requireOk(uplink, 'receipt uplink'); // Assert receipt uplink returned ok.
  assert.ok(uplinkJson.fact_id, 'receipt fact_id missing'); // Receipt fact id must be present.

  const duplicateUplinkBody = { // Build duplicate receipt body.
    tenant_id, project_id, group_id, // Bind request to the tenant triple.
    task_id: actTaskId, // New receipt contract requires explicit task_id.
    act_task_id: actTaskId, // Preserve backward-compatible alias for current route shape.
    command_id: actTaskId, // Command id must match task id.
    device_id, // Reuse the same device id.
    status: 'executed', // Reuse the same status.
    observed_parameters: {}, // Reuse the same observed parameters.
    meta: { idempotency_key: `receipt-duplicate-${actTaskId}` } // Use a new idempotency key to prove duplicate guard is task-based.
  };

  const duplicateUplink = await fetchJson(`${base}/api/v1/ao-act/receipts/uplink`, { // Re-send the same receipt to validate duplicate protection.
    method: 'POST', token, // Send authenticated POST request.
    body: duplicateUplinkBody // Use explicit body object for easier debugging.
  });
  assert.strictEqual(duplicateUplink.status, 409, `expected 409 for duplicate receipt, got ${duplicateUplink.status}`); // Duplicate receipts must be rejected.
  assert.strictEqual(duplicateUplink.json?.error, 'DUPLICATE_RECEIPT', 'expected DUPLICATE_RECEIPT'); // Error code must stay stable.

  const planRead2 = await fetchJson(`${base}/api/v1/operations/plans/${encodeURIComponent(subJson.operation_plan_id)}?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}`, { // Re-read operation plan after receipt.
    method: 'GET', token // Use authenticated GET request.
  });
  const planReadJson2 = requireOk(planRead2, 'plan read after receipt'); // Assert post-receipt plan read returned ok.
  assert.strictEqual(planReadJson2.item?.plan?.record_json?.payload?.status, 'SUCCEEDED', 'plan status should be SUCCEEDED after uplink');
  assert.strictEqual(String(planReadJson2.item?.plan?.record_json?.payload?.act_task_id || ''), String(actTaskId), 'plan should bind to act_task_id'); // Operation plan must bind the task id after approval.

  const plansList = await fetchJson(`${base}/api/v1/operations/plans?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&limit=5`, { // List recent operation plans.
    method: 'GET', token // Use authenticated GET request.
  });
  const plansListJson = requireOk(plansList, 'plans list'); // Assert list returned ok.
  assert.ok(Array.isArray(plansListJson.items), 'plans list items must be array'); // Items must remain array-shaped.
  assert.ok(plansListJson.items.some((x) => x?.operation_plan?.payload?.operation_plan_id === subJson.operation_plan_id), 'operation plan not found in list'); // Created plan must be visible in list.

  const exportCreate = await fetchJson(`${base}/api/v1/evidence-export/jobs`, { // Create evidence export job for the field scope covering this full chain.
    method: 'POST', token, // Send authenticated POST request.
    body: { // Build export job body.
      scope_type: 'FIELD', // Export the field-scoped evidence chain.
      scope_id: field_id, // Scope export to the tested field.
      from_ts_ms: Date.now() - export_window_before_ms, // Start early enough to include recommendation + approval facts.
      to_ts_ms: Date.now() + export_window_after_ms, // End late enough to include async completion facts.
      export_format: 'JSON', // Request JSON bundle for deterministic parsing.
      export_language: 'zh-CN' // Keep export language explicit.
    }
  });
  const exportCreateJson = requireOk(exportCreate, 'evidence export create'); // Assert export creation returned ok.
  const exportJobId = String(exportCreateJson.job_id ?? ''); // Extract export job id.
  assert.ok(exportJobId, 'evidence export job_id missing'); // Export job id must be present.

  let exportJobJson = null; // Track latest job payload while polling.
  for (let i = 0; i < 40; i += 1) { // Poll bounded number of times.
    await sleep(250); // Yield briefly for in-process job execution.
    const exportStatus = await fetchJson(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(exportJobId)}`, { method: 'GET', token }); // Read current job status.
    exportJobJson = requireOk(exportStatus, 'evidence export status'); // Assert status read returned ok.
    const jobStatus = String(exportJobJson.job?.status ?? '').toUpperCase(); // Normalize job status for comparison.
    if (jobStatus === 'DONE') break; // Stop polling once job completed.
    assert.notStrictEqual(jobStatus, 'ERROR', `evidence export job failed: ${exportStatus.text}`); // Fail fast on terminal job error.
  }
  assert.strictEqual(String(exportJobJson?.job?.status ?? '').toUpperCase(), 'DONE', 'evidence export job should finish as DONE'); // Export job must finish successfully.

  const exportDownload = await fetch(`${base}/api/v1/evidence-export/jobs/${encodeURIComponent(exportJobId)}/download`, { // Download the finished JSON evidence bundle.
    method: 'GET', // Use GET request for the artifact download.
    headers: token ? { authorization: `Bearer ${token}` } : {} // Forward bearer token when present.
  });
  const exportText = await exportDownload.text(); // Read artifact body as text.
  assert.strictEqual(exportDownload.ok, true, `evidence export download status=${exportDownload.status} body=${exportText}`); // Download must return HTTP ok.
  const exportBundle = JSON.parse(exportText); // Parse JSON evidence bundle.
  const exportFacts = Array.isArray(exportBundle?.facts) ? exportBundle.facts : []; // Normalize exported facts array.
  const exportFactTypes = new Set(exportFacts.map((item) => String(item?.record_json?.type ?? ''))); // Collect exported fact types for assertions.
  console.log('DEBUG export fact types', Array.from(exportFactTypes).sort());
  assert.ok(exportFactTypes.has('operation_plan_v1'), 'evidence export missing operation_plan_v1'); // Export must include operation_plan facts.
  assert.ok(exportFactTypes.has('operation_plan_transition_v1'), 'evidence export missing operation_plan_transition_v1'); // Export must include operation_plan transition facts.
  assert.ok(exportFactTypes.has('approval_decision_v1'), 'evidence export missing approval_decision_v1'); // Export must still include approval decision facts.
  assert.ok(exportFactTypes.has('ao_act_receipt_v0'), 'evidence export missing ao_act_receipt_v0'); // Export must still include receipt facts.

  console.log('PASS e2e acceptance (recommendation->approval->operation_plan->dispatch bridge->receipt->export)', { // Print final success summary.
    recommendation_id: recId, // Emit recommendation id for debugging.
    approval_request_id: subJson.approval_request_id, // Emit approval request id for debugging.
    operation_plan_id: subJson.operation_plan_id, // Emit operation plan id for debugging.
    act_task_id: actTaskId, // Emit act task id for debugging.
    receipt_fact_id: uplinkJson.fact_id, // Emit receipt fact id for debugging.
    export_job_id: exportJobId // Emit export job id for debugging.
  });
})().catch((e) => {
  console.error('FAIL e2e acceptance', e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
}); // Fail the process on any assertion or runtime error.
