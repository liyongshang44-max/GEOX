// GEOX/apps/server/src/routes/openapi_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance type.

function buildOpenApiSpec() { // Build a minimal Commercial v1 OpenAPI document.
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "GEOX Commercial API",
      version: "v1",
      description: "GEOX Commercial v1 minimal OpenAPI covering auth, devices, fields, telemetry, alerts, exports, operations, and dashboard."
    },
    servers: [
      { url: "http://127.0.0.1:3001", description: "Local development" }
    ],
    tags: [
      { name: "auth", description: "Authentication and session info" },
      { name: "devices", description: "Device registration, credentials, and device console" },
      { name: "fields", description: "Fields, seasons, bindings, and field workbench" },
      { name: "telemetry", description: "Telemetry queries and device heartbeat" },
      { name: "alerts", description: "Alert rules, events, and notification records" },
      { name: "exports", description: "Evidence export and audit downloads" },
      { name: "operations", description: "Approvals, execution, and operations workbench" },
      { name: "judge", description: "Judge V2 evaluation and result query" },
      { name: "dashboard", description: "Commercial dashboard overview" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Token"
        }
      },
      schemas: {
        DeviceRegistrationRequest: {
          type: "object",
          required: ["device_id", "device_mode", "device_template"],
          properties: {
            device_id: { type: "string" },
            display_name: { type: "string" },
            device_mode: { type: "string", enum: ["real", "simulator"], description: "Device onboarding mode contract." },
            device_template: { type: "string", description: "Unified device template field (preferred)." },
            template_code: { type: "string", description: "Legacy alias of device_template; kept for compatibility." }
          }
        },
        HeartbeatRequest: {
          type: "object",
          properties: {
            battery_percent: { type: "number" },
            signal_dbm: { type: "number" },
            fw_ver: { type: "string" }
          }
        },
        EvidenceExportCreateRequest: {
          type: "object",
          required: ["scope_type"],
          properties: {
            scope_type: { type: "string", enum: ["TENANT", "FIELD", "DEVICE"] },
            field_id: { type: "string" },
            device_id: { type: "string" },
            export_format: { type: "string", enum: ["JSON", "CSV", "PDF"] },
            export_language: { type: "string", enum: ["zh-CN", "en-US"] }
          }
        },
        AlertRuleRequest: {
          type: "object",
          required: ["rule_id", "metric_key", "operator", "threshold_value"],
          properties: {
            rule_id: { type: "string" },
            metric_key: { type: "string" },
            operator: { type: "string", enum: [">", ">=", "<", "<=", "=", "!="] },
            threshold_value: { type: "number" },
            window_minutes: { type: "integer" },
            device_id: { type: "string" },
            field_id: { type: "string" },
            notify_channels: {
              type: "array",
              items: { type: "string", enum: ["INAPP", "WEBHOOK", "EMAIL", "SMS", "WECHAT", "DINGTALK"] }
            }
          }
        },
        AlertV1: {
          type: "object",
          required: [
            "type",
            "version",
            "alert_id",
            "category",
            "severity",
            "status",
            "title",
            "message",
            "recommended_action",
            "reasons",
            "source_refs",
            "triggered_at",
            "object_type",
            "object_id",
            "tenant_id",
            "project_id",
            "group_id"
          ],
          properties: {
            type: { type: "string", enum: ["alert_v1"] },
            version: { type: "string", enum: ["v1"] },
            alert_id: { type: "string" },
            category: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            status: { type: "string", enum: ["OPEN", "ACKED", "CLOSED"] },
            title: { type: "string" },
            message: { type: "string" },
            recommended_action: { type: "string" },
            reasons: { type: "array", items: { type: "string" } },
            source_refs: {
              type: "array",
              items: {
                type: "object",
                required: ["type", "id"],
                properties: {
                  type: { type: "string" },
                  id: { type: "string" },
                  uri: { type: "string" },
                  ts_ms: { type: "integer", format: "int64" }
                }
              }
            },
            triggered_at: { type: "string", format: "date-time", description: "ISO-8601 timestamp string." },
            object_type: { type: "string", enum: ["OPERATION", "DEVICE", "FIELD", "SYSTEM"] },
            object_id: { type: "string" },
            tenant_id: { type: "string" },
            project_id: { type: "string" },
            group_id: { type: "string" }
          }
        },
        AlertListResponseV1: {
          type: "object",
          required: ["ok", "items"],
          properties: {
            ok: { type: "boolean" },
            items: {
              type: "array",
              items: { '$ref': "#/components/schemas/AlertV1" }
            }
          }
        },
        AlertSummaryResponseV1: {
          type: "object",
          required: ["ok", "total", "by_severity", "by_status", "by_category"],
          properties: {
            ok: { type: "boolean" },
            total: { type: "integer" },
            by_severity: {
              type: "object",
              required: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              properties: {
                LOW: { type: "integer", minimum: 0 },
                MEDIUM: { type: "integer", minimum: 0 },
                HIGH: { type: "integer", minimum: 0 },
                CRITICAL: { type: "integer", minimum: 0 }
              }
            },
            by_status: {
              type: "object",
              required: ["OPEN", "ACKED", "CLOSED"],
              properties: {
                OPEN: { type: "integer", minimum: 0 },
                ACKED: { type: "integer", minimum: 0 },
                CLOSED: { type: "integer", minimum: 0 }
              }
            },
            by_category: {
              type: "object",
              additionalProperties: { type: "integer", minimum: 0 }
            }
          }
        },
        WorkflowStatusV1: {
          type: "string",
          enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "ACKED", "RESOLVED", "CLOSED"]
        },
        PriorityV1: {
          type: "integer",
          enum: [1, 2, 3, 4],
          description: "Priority enum mapped as P1=1, P2=2, P3=3, P4=4."
        },
        AlertWorkItemV1: {
          allOf: [
            { '$ref': "#/components/schemas/AlertV1" },
            {
              type: "object",
              required: ["workflow_status", "assignee", "priority", "sla_due_at", "sla_breached", "last_note", "field_id", "operation_plan_id", "device_id"],
              properties: {
                workflow_status: { '$ref': "#/components/schemas/WorkflowStatusV1" },
                assignee: {
                  type: "object",
                  required: ["actor_id", "name"],
                  properties: {
                    actor_id: { type: "string", nullable: true },
                    name: { type: "string", nullable: true }
                  }
                },
                priority: { '$ref': "#/components/schemas/PriorityV1" },
                sla_due_at: { type: "integer", format: "int64", nullable: true },
                sla_breached: { type: "boolean" },
                last_note: { type: "string", nullable: true },
                field_id: { type: "string", nullable: true },
                operation_plan_id: { type: "string", nullable: true },
                device_id: { type: "string", nullable: true }
              }
            }
          ]
        },
        AlertWorkboardListResponseV1: {
          type: "object",
          required: ["ok", "items", "total"],
          properties: {
            ok: { type: "boolean" },
            items: { type: "array", items: { '$ref': "#/components/schemas/AlertWorkItemV1" } },
            total: { type: "integer", minimum: 0 }
          }
        },
        AlertWorkflowWriteRequestV1: {
          type: "object",
          properties: {
            assignee_actor_id: { type: "string" },
            assignee_name: { type: "string" },
            priority: { '$ref': "#/components/schemas/PriorityV1" },
            sla_due_at: { type: "integer", format: "int64", nullable: true },
            note: { type: "string" },
            expected_version: { type: "integer", minimum: 0 }
          }
        },
        AlertWorkflowWriteResponseV1: {
          type: "object",
          required: ["ok", "alert_id", "workflow_status", "version", "updated_by", "updated_at"],
          properties: {
            ok: { type: "boolean" },
            alert_id: { type: "string" },
            workflow_status: { '$ref': "#/components/schemas/WorkflowStatusV1" },
            version: { type: "integer", minimum: 0 },
            updated_by: { type: "string" },
            updated_at: { type: "integer", format: "int64" }
          }
        },
        FieldPortfolioItemV1: {
          type: "object",
          required: [
            "field_id",
            "field_name",
            "risk",
            "alert_summary",
            "pending_acceptance_summary",
            "latest_operation",
            "cost_summary",
            "telemetry"
          ],
          properties: {
            field_id: { type: "string" },
            field_name: { type: "string", nullable: true },
            risk: {
              type: "object",
              required: ["level", "reasons"],
              properties: {
                level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                reasons: { type: "array", items: { type: "string" } }
              }
            },
            alert_summary: {
              type: "object",
              required: ["open_count", "high_or_above_count"],
              properties: {
                open_count: { type: "integer", minimum: 0 },
                high_or_above_count: { type: "integer", minimum: 0 }
              }
            },
            pending_acceptance_summary: {
              type: "object",
              required: ["pending_acceptance_count", "invalid_execution_count"],
              properties: {
                pending_acceptance_count: { type: "integer", minimum: 0 },
                invalid_execution_count: { type: "integer", minimum: 0 }
              }
            },
            latest_operation: {
              type: "object",
              required: ["happened_at", "action_type", "status"],
              properties: {
                happened_at: { type: "string", format: "date-time", nullable: true },
                action_type: { type: "string", nullable: true },
                status: { type: "string", nullable: true }
              }
            },
            cost_summary: {
              type: "object",
              required: ["estimated_total", "actual_total"],
              properties: {
                estimated_total: { type: "number" },
                actual_total: { type: "number" }
              }
            },
            telemetry: {
              type: "object",
              required: ["last_telemetry_at", "device_offline"],
              properties: {
                last_telemetry_at: { type: "string", format: "date-time", nullable: true },
                device_offline: { type: "boolean" }
              }
            }
          }
        },
        FieldPortfolioListResponseV1: {
          type: "object",
          required: ["ok", "count", "items", "summary"],
          properties: {
            ok: { type: "boolean" },
            count: { type: "integer", minimum: 0 },
            items: {
              type: "array",
              items: { '$ref': "#/components/schemas/FieldPortfolioItemV1" }
            },
            summary: {
              type: "object",
              required: [
                "total_fields",
                "by_risk",
                "total_open_alerts",
                "total_pending_acceptance",
                "total_invalid_execution",
                "total_estimated_cost",
                "total_actual_cost",
                "offline_fields"
              ],
              properties: {
                total_fields: { type: "integer", minimum: 0 },
                by_risk: {
                  type: "object",
                  required: ["low", "medium", "high"],
                  properties: {
                    low: { type: "integer", minimum: 0 },
                    medium: { type: "integer", minimum: 0 },
                    high: { type: "integer", minimum: 0 }
                  }
                },
                total_open_alerts: { type: "integer", minimum: 0 },
                total_pending_acceptance: { type: "integer", minimum: 0 },
                total_invalid_execution: { type: "integer", minimum: 0 },
                total_estimated_cost: { type: "number" },
                total_actual_cost: { type: "number" },
                offline_fields: { type: "integer", minimum: 0 }
              }
            }
          }
        },
        FieldPortfolioSummaryResponseV1: {
          type: "object",
          required: ["ok", "summary"],
          properties: {
            ok: { type: "boolean" },
            summary: {
              type: "object",
              required: [
                "total_fields",
                "by_risk",
                "total_open_alerts",
                "total_pending_acceptance",
                "total_invalid_execution",
                "total_estimated_cost",
                "total_actual_cost",
                "offline_fields"
              ],
              properties: {
                total_fields: { type: "integer", minimum: 0 },
                by_risk: {
                  type: "object",
                  required: ["low", "medium", "high"],
                  properties: {
                    low: { type: "integer", minimum: 0 },
                    medium: { type: "integer", minimum: 0 },
                    high: { type: "integer", minimum: 0 }
                  }
                },
                total_open_alerts: { type: "integer", minimum: 0 },
                total_pending_acceptance: { type: "integer", minimum: 0 },
                total_invalid_execution: { type: "integer", minimum: 0 },
                total_estimated_cost: { type: "number" },
                total_actual_cost: { type: "number" },
                offline_fields: { type: "integer", minimum: 0 }
              }
            }
          }
        },
        FieldTagItemV1: {
          type: "object",
          required: ["tag", "created_at", "created_by"],
          properties: {
            tag: { type: "string" },
            created_at: { type: "string", format: "date-time", nullable: true },
            created_by: { type: "string", nullable: true }
          }
        },
        FieldTagsResponseV1: {
          type: "object",
          required: ["ok", "field_id"],
          properties: {
            ok: { type: "boolean" },
            field_id: { type: "string" },
            count: { type: "integer", minimum: 0 },
            items: { type: "array", items: { '$ref': "#/components/schemas/FieldTagItemV1" } },
            tag: { type: "string", nullable: true }
          }
        },
        AlertAckRequestV1: {
          type: "object",
          properties: {
            note: { type: "string", description: "Optional operator note for ack action." }
          }
        },
        AlertResolveRequestV1: {
          type: "object",
          properties: {
            note: { type: "string", description: "Optional operator note for resolve action." },
            linked_operation_id: { type: "string", description: "Optional linked operation id for operation_workflow_v1 upsert and alert owner/note sync." },
            operation_id: { type: "string", description: "Alias of linked_operation_id for compatibility." },
            assignee_actor_id: { type: "string", description: "Optional owner actor id; when linked_operation_id is provided it will be stored into operation_workflow_v1." },
            assignee_name: { type: "string", description: "Optional owner name; when linked_operation_id is provided it will be stored into operation_workflow_v1." }
          }
        },
        AlertAckResponseV1: {
          type: "object",
          required: ["ok", "alert_id", "status", "acted_at"],
          properties: {
            ok: { type: "boolean" },
            alert_id: { type: "string" },
            status: { type: "string", enum: ["ACKED"] },
            acted_at: { type: "integer", format: "int64" }
          }
        },
        AlertResolveResponseV1: {
          type: "object",
          required: ["ok", "alert_id", "status", "acted_at"],
          properties: {
            ok: { type: "boolean" },
            alert_id: { type: "string" },
            status: { type: "string", enum: ["OPEN", "ACKED", "CLOSED"] },
            acted_at: { type: "integer", format: "int64" },
            note: { type: "string" }
          }
        },
        DeviceSimulatorStartRequest: {
          type: "object",
          description: "Start simulator runner for a device. profile_code is reserved for profile selection and currently optional.",
          properties: {
            interval_ms: {
              type: "integer",
              minimum: 1000,
              maximum: 60000,
              default: 5000,
              description: "Simulation tick interval in milliseconds. Server clamps into [1000, 60000]."
            },
            profile_code: {
              type: "string",
              description: "Optional simulator profile code (reserved for compatibility / rollout)."
            }
          }
        },
        DeviceSimulatorLegacyRequest: {
          type: "object",
          required: ["device_id"],
          properties: {
            device_id: { type: "string" },
            interval_ms: {
              type: "integer",
              minimum: 1000,
              maximum: 60000,
              default: 5000
            },
            profile_code: { type: "string" }
          }
        },
        DeviceSimulatorStatusResponse: {
          type: "object",
          required: ["ok", "tenant_id", "device_id", "key", "running"],
          properties: {
            ok: { type: "boolean" },
            tenant_id: { type: "string" },
            device_id: { type: "string" },
            key: { type: "string" },
            running: { type: "boolean" },
            already_running: { type: "boolean" },
            already_stopped: { type: "boolean" },
            started_ts_ms: { type: "integer", format: "int64" },
            interval_ms: { type: "integer" },
            last_tick_ts_ms: { type: "integer", format: "int64", nullable: true },
            seq: { type: "integer" },
            deprecated: { type: "boolean" },
            replacement: { type: "string" }
          }
        },
        SkillRunV1: {
          type: "object",
          required: [
            "skill_run_id",
            "skill_id",
            "category",
            "status",
            "started_at_ts_ms",
            "finished_at_ts_ms",
            "target",
            "input_digest",
            "output_digest",
            "explanation_codes"
          ],
          properties: {
            skill_run_id: { type: "string" },
            skill_id: { type: "string" },
            category: { type: "string", enum: ["sensing", "agronomy", "device", "acceptance"] },
            status: { type: "string", enum: ["success", "failed"] },
            started_at_ts_ms: { type: "integer", format: "int64", description: "Unix epoch timestamp in milliseconds." },
            finished_at_ts_ms: { type: "integer", format: "int64", description: "Unix epoch timestamp in milliseconds." },
            target: {
              type: "object",
              properties: {
                field_id: { type: "string" },
                device_id: { type: "string" }
              },
              additionalProperties: false
            },
            input_digest: { type: "string" },
            output_digest: { type: "string" },
            explanation_codes: { type: "array", items: { type: "string" }, description: "Stable explanation code list; empty array when absent." }
          }
        },
        SkillRunListV1Response: {
          type: "object",
          required: ["ok", "limit", "items"],
          properties: {
            ok: { type: "boolean" },
            limit: { type: "integer", minimum: 1, maximum: 200 },
            items: {
              type: "array",
              items: { '$ref': "#/components/schemas/SkillRunV1" }
            }
          }
        },
        OperationReportV1: {
          type: "object",
          required: ["type", "version", "generated_at", "approval", "why", "operation_title", "customer_title", "identifiers", "execution", "acceptance", "evidence", "cost", "sla", "risk", "workflow"],
          properties: {
            type: { type: "string", enum: ["operation_report_v1"] },
            version: { type: "string", enum: ["v1"] },
            generated_at: { type: "string", format: "date-time" },
            approval: {
              type: "object",
              required: ["status", "actor_id", "actor_name", "generated_at", "approved_at", "note"],
              properties: {
                status: { type: "string", nullable: true },
                actor_id: { type: "string", nullable: true },
                actor_name: { type: "string", nullable: true },
                generated_at: { type: "string", format: "date-time", nullable: true },
                approved_at: { type: "string", format: "date-time", nullable: true },
                note: { type: "string", nullable: true }
              }
            },
            why: {
              type: "object",
              required: ["explain_human", "objective_text"],
              properties: {
                explain_human: { type: "string", nullable: true },
                objective_text: { type: "string", nullable: true }
              }
            },
            operation_title: { type: "string", nullable: true },
            customer_title: { type: "string", nullable: true },
            identifiers: {
              type: "object",
              required: ["tenant_id", "project_id", "group_id", "field_id", "operation_plan_id", "operation_id", "recommendation_id", "act_task_id", "receipt_id"],
              properties: {
                tenant_id: { type: "string" },
                project_id: { type: "string" },
                group_id: { type: "string" },
                field_id: { type: "string", nullable: true },
                operation_plan_id: { type: "string" },
                operation_id: { type: "string" },
                recommendation_id: { type: "string", nullable: true },
                act_task_id: { type: "string", nullable: true },
                receipt_id: { type: "string", nullable: true }
              }
            },
            execution: {
              type: "object",
              required: ["final_status", "invalid_execution", "invalid_reason", "dispatched_at", "execution_started_at", "execution_finished_at", "response_time_ms"],
              properties: {
                final_status: { type: "string" },
                invalid_execution: { type: "boolean" },
                invalid_reason: { type: "string", nullable: true },
                dispatched_at: { type: "string", format: "date-time", nullable: true },
                execution_started_at: { type: "string", format: "date-time", nullable: true },
                execution_finished_at: { type: "string", format: "date-time", nullable: true },
                response_time_ms: { type: "number", nullable: true }
              }
            },
            acceptance: {
              type: "object",
              required: ["status", "verdict", "missing_evidence", "missing_items", "generated_at"],
              properties: {
                status: { type: "string", enum: ["PASS", "FAIL", "PENDING", "NOT_AVAILABLE"] },
                verdict: { type: "string", nullable: true },
                missing_evidence: { type: "boolean" },
                missing_items: { type: "array", items: { type: "string" } },
                generated_at: { type: "string", format: "date-time", nullable: true }
              }
            },
            evidence: {
              type: "object",
              required: ["artifacts_count", "logs_count", "media_count", "metrics_count", "receipt_present", "acceptance_present"],
              properties: {
                artifacts_count: { type: "integer" },
                logs_count: { type: "integer" },
                media_count: { type: "integer" },
                metrics_count: { type: "integer" },
                receipt_present: { type: "boolean" },
                acceptance_present: { type: "boolean" }
              }
            },
            cost: {
              type: "object",
              required: ["estimated_total"],
              properties: {
                estimated_total: { type: "number" },
                actual_total: { type: "number" },
                actual_water_cost: { type: "number" },
                actual_electric_cost: { type: "number" },
                actual_chemical_cost: { type: "number" },
                estimated_water_cost: { type: "number" },
                estimated_electric_cost: { type: "number" },
                estimated_chemical_cost: { type: "number" }
              }
            },
            sla: {
              type: "object",
              required: [
                "dispatch_latency_quality",
                "execution_duration_quality",
                "acceptance_latency_quality",
                "execution_success",
                "acceptance_pass",
                "response_time_ms",
                "invalid_reasons",
                "pending_acceptance_elapsed_ms",
                "pending_acceptance_over_30m"
              ],
              properties: {
                dispatch_latency_quality: { type: "string", enum: ["VALID", "MISSING_DATA", "INVALID_ORDER"] },
                execution_duration_quality: { type: "string", enum: ["VALID", "MISSING_DATA", "INVALID_ORDER"] },
                acceptance_latency_quality: { type: "string", enum: ["VALID", "MISSING_DATA", "INVALID_ORDER"] },
                execution_success: { type: "boolean" },
                acceptance_pass: { type: "boolean" },
                response_time_ms: { type: "number", nullable: true },
                dispatch_latency_ms: { type: "number", nullable: true },
                execution_duration_ms: { type: "number", nullable: true },
                acceptance_latency_ms: { type: "number", nullable: true },
                invalid_reasons: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "dispatch_latency_missing_start",
                      "dispatch_latency_missing_end",
                      "dispatch_latency_negative_duration",
                      "execution_duration_missing_start",
                      "execution_duration_missing_end",
                      "execution_duration_negative_duration",
                      "acceptance_latency_missing_start",
                      "acceptance_latency_missing_end",
                      "acceptance_latency_negative_duration"
                    ]
                  }
                },
                pending_acceptance_elapsed_ms: { type: "number", nullable: true },
                pending_acceptance_over_30m: { type: "boolean" }
              }
            },
            risk: {
              type: "object",
              required: ["level", "reasons"],
              properties: {
                level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                reasons: { type: "array", items: { type: "string" } }
              }
            },
            workflow: {
              type: "object",
              required: ["owner_actor_id", "owner_name", "last_note", "updated_at", "updated_by"],
              properties: {
                owner_actor_id: { type: "string", nullable: true },
                owner_name: { type: "string", nullable: true },
                last_note: { type: "string", nullable: true },
                updated_at: { type: "string", format: "date-time", nullable: true },
                updated_by: { type: "string", nullable: true }
              }
            }
          }
        },
        OperationReportSingleResponse: {
          type: "object",
          required: ["ok", "operation_report_v1"],
          properties: {
            ok: { type: "boolean" },
            operation_report_v1: { '$ref': "#/components/schemas/OperationReportV1" }
          }
        },
        OperationReportFieldListResponse: {
          type: "object",
          required: ["ok", "items"],
          properties: {
            ok: { type: "boolean" },
            items: { type: "array", items: { '$ref': "#/components/schemas/OperationReportV1" } }
          }
        },
        CustomerDashboardAggregateResponse: {
          type: "object",
          required: ["ok", "aggregate"],
          properties: {
            ok: { type: "boolean" },
            aggregate: {
              type: "object",
              required: ["fields", "top_risk_fields", "recent_operations", "risk_summary", "period_summary", "pending_actions_summary", "device_summary"],
              properties: {
                fields: {
                  type: "object",
                  required: ["total", "healthy", "at_risk"],
                  properties: {
                    total: { type: "integer" },
                    healthy: { type: "integer" },
                    at_risk: { type: "integer" }
                  }
                },
                top_risk_fields: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["field_id", "field_name", "risk_level", "risk_reasons", "open_alerts_count", "pending_acceptance_count", "last_operation_at"],
                    properties: {
                      field_id: { type: "string" },
                      field_name: { type: "string", nullable: true },
                      risk_level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                      risk_reasons: { type: "array", items: { type: "string" } },
                      open_alerts_count: { type: "integer" },
                      pending_acceptance_count: { type: "integer" },
                      last_operation_at: { type: "string", format: "date-time", nullable: true }
                    }
                  }
                },
                recent_operations: {
                  type: "array",
                  items: {
                    type: "object",                    
                    required: ["operation_id", "operation_plan_id", "field_id", "field_name", "title", "customer_title", "executed_at", "final_status", "acceptance_status", "risk_level", "risk_reasons", "estimated_total_cost", "execution_duration_ms"],
                    properties: {
                      operation_id: { type: "string" },
                      operation_plan_id: { type: "string" },
                      field_id: { type: "string" },
                      field_name: { type: "string", nullable: true },
                      title: { type: "string", nullable: true },
                      customer_title: { type: "string", nullable: true },
                      executed_at: { type: "string", format: "date-time", nullable: true },
                      final_status: { type: "string" },
                      acceptance_status: { type: "string", nullable: true },
                      risk_level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                      risk_reasons: { type: "array", items: { type: "string" } },
                      estimated_total_cost: { type: "number" },
                      execution_duration_ms: { type: "number", nullable: true }
                    }
                  }
                },
                risk_summary: {
                  type: "object",
                  required: ["level", "top_reasons"],
                  properties: {
                    level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                    top_reasons: { type: "array", items: { type: "string" } }
                  }
                },
                period_summary: {
                  type: "object",
                  required: ["total_operations", "estimated_total_cost", "actual_total_cost", "avg_sla_ms"],
                  properties: {
                    total_operations: { type: "integer" },
                    estimated_total_cost: { type: "number" },
                    actual_total_cost: { type: "number" },
                    avg_sla_ms: { type: "number", nullable: true }
                  }
                },
                pending_actions_summary: {
                  type: "object",
                  required: ["total_open_alerts", "unassigned_alerts", "in_progress_alerts", "sla_breached_alerts", "closed_today_alerts", "pending_acceptance"],
                  properties: {
                    total_open_alerts: { type: "integer" },
                    unassigned_alerts: { type: "integer" },
                    in_progress_alerts: { type: "integer" },
                    sla_breached_alerts: { type: "integer" },
                    closed_today_alerts: { type: "integer" },
                    pending_acceptance: { type: "integer" }
                  }
                },
                device_summary: {
                  type: "object",
                  required: ["offline_fields", "total_devices", "offline_devices"],
                  properties: {
                    offline_fields: { type: "integer" },
                    total_devices: { type: "integer" },
                    offline_devices: { type: "integer" }
                  }
                }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ],
    paths: {
      "/api/v1/auth/login": {
        post: {
          tags: ["auth"],
          summary: "Login via local allowlist or external IdP",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { type: "object" }
              }
            }
          },
          responses: {
            "200": { description: "Login response returned successfully" }
          }
        }
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["auth"],
          summary: "Logout current session",
          responses: {
            "200": { description: "Logout response returned successfully" }
          }
        }
      },
      "/api/v1/auth/providers": {
        get: {
          tags: ["auth"],
          summary: "Read configured auth providers",
          responses: {
            "200": { description: "Provider info returned successfully" }
          }
        }
      },
      "/api/v1/auth/me": {
        get: {
          tags: ["auth"],
          summary: "Read current session and role info",
          responses: {
            "200": { description: "Session info returned successfully" }
          }
        }
      },
      "/api/v1/skill-runs": {
        get: {
          tags: ["operations"],
          summary: "List normalized skill runs (v1 taskbook enum mapping)",
          parameters: [
            { name: "tenant_id", in: "query", required: false, schema: { type: "string" } },
            { name: "field_id", in: "query", required: false, schema: { type: "string" } },
            { name: "device_id", in: "query", required: false, schema: { type: "string" } },
            { name: "category", in: "query", required: false, schema: { type: "string", enum: ["sensing", "agronomy", "device", "acceptance"] } },
            { name: "status", in: "query", required: false, schema: { type: "string", enum: ["success", "failed"] } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }
          ],
          responses: {
            "200": {
              description: "Normalized skill run list",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/SkillRunListV1Response" }
                }
              }
            }
          }
        }
      },
      "/api/v1/devices/{id}/simulator/start": {
        post: {
          tags: ["devices"],
          summary: "Start simulator for a specific device",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Target device id" }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/DeviceSimulatorStartRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Simulator started (or already running)",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            },
            "400": { description: "Missing or invalid device id" },
            "404": { description: "Device not found under current tenant" }
          }
        }
      },
      "/api/v1/devices/{id}/simulator/stop": {
        post: {
          tags: ["devices"],
          summary: "Stop simulator for a specific device",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Target device id" }
          ],
          responses: {
            "200": {
              description: "Simulator stopped (or already stopped)",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            },
            "400": { description: "Missing or invalid device id" },
            "404": { description: "Device not found under current tenant" }
          }
        }
      },
      "/api/v1/devices/{id}/simulator/status": {
        get: {
          tags: ["devices"],
          summary: "Read simulator status for a specific device",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Target device id" }
          ],
          responses: {
            "200": {
              description: "Simulator status returned",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            },
            "400": { description: "Missing or invalid device id" },
            "404": { description: "Device not found under current tenant" }
          }
        }
      },
      "/api/v1/devices/simulator/statuses": {
        get: {
          tags: ["devices"],
          summary: "List simulator statuses across tenant-scoped devices",
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 500 }, description: "Max number of rows to return" },
            { name: "tenant_id", in: "query", required: false, schema: { type: "string" }, description: "Compatibility-only. Ignored; auth context is authoritative." },
            { name: "project_id", in: "query", required: false, schema: { type: "string" }, description: "Compatibility-only. Ignored; auth context is authoritative." },
            { name: "group_id", in: "query", required: false, schema: { type: "string" }, description: "Compatibility-only. Ignored; auth context is authoritative." }
          ],
          responses: {
            "200": {
              description: "Tenant-scoped simulator status list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      tenant_id: { type: "string" },
                      project_id: { type: ["string", "null"] },
                      group_id: { type: ["string", "null"] },
                      scope_source: { type: "string", enum: ["auth_context"] },
                      scope_query_ignored: { type: "boolean" },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            tenant_id: { type: "string" },
                            project_id: { type: ["string", "null"] },
                            group_id: { type: ["string", "null"] },
                            device_id: { type: "string" },
                            display_name: { type: ["string", "null"] },
                            device_mode: { type: ["string", "null"] },
                            key: { type: "string" },
                            running: { type: "boolean" },
                            status: { type: "string" },
                            started_ts_ms: { type: ["number", "null"] },
                            stopped_ts_ms: { type: ["number", "null"] },
                            interval_ms: { type: "number" },
                            last_tick_ts_ms: { type: ["number", "null"] },
                            last_error: { type: ["string", "null"] },
                            updated_ts_ms: { type: ["number", "null"] }
                          },
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["ok", "tenant_id", "scope_source", "scope_query_ignored", "items"],
                    additionalProperties: false
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/simulator-runner/start": {
        post: {
          tags: ["devices"],
          summary: "[Deprecated] Start simulator via legacy runner endpoint",
          deprecated: true,
          description: "Deprecated. Replacement: POST /api/v1/devices/{id}/simulator/start",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/DeviceSimulatorLegacyRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Legacy response with deprecated=true and replacement path",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/simulator-runner/stop": {
        post: {
          tags: ["devices"],
          summary: "[Deprecated] Stop simulator via legacy runner endpoint",
          deprecated: true,
          description: "Deprecated. Replacement: POST /api/v1/devices/{id}/simulator/stop",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["device_id"],
                  properties: {
                    device_id: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Legacy response with deprecated=true and replacement path",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/simulator-runner/status": {
        get: {
          tags: ["devices"],
          summary: "[Deprecated] Read simulator status via legacy runner endpoint",
          deprecated: true,
          description: "Deprecated. Replacement: GET /api/v1/devices/{id}/simulator/status",
          parameters: [
            { name: "device_id", in: "query", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Legacy response with deprecated=true and replacement path",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceSimulatorStatusResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/fields": {
        get: {
          tags: ["fields"],
          summary: "Read field list",
          responses: {
            "200": { description: "Field list returned successfully" }
          }
        }
      },
      "/api/v1/fields/portfolio": {
        get: {
          tags: ["fields"],
          summary: "Read field portfolio list",
          parameters: [
            { name: "tenant_id", in: "query", required: false, schema: { type: "string" } },
            { name: "project_id", in: "query", required: false, schema: { type: "string" } },
            { name: "group_id", in: "query", required: false, schema: { type: "string" } },
            { name: "field_ids[]", in: "query", required: false, schema: { type: "array", items: { type: "string" } }, style: "form", explode: true },
            { name: "field_id", in: "query", required: false, schema: { type: "string" } },
            { name: "window_ms", in: "query", required: false, schema: { type: "integer", minimum: 60000 } },
            { name: "tags[]", in: "query", required: false, schema: { type: "array", items: { type: "string" } }, style: "form", explode: true },
            { name: "risk_levels[]", in: "query", required: false, schema: { type: "array", items: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] } }, style: "form", explode: true },
            { name: "has_open_alerts", in: "query", required: false, schema: { type: "boolean" } },
            { name: "has_pending_acceptance", in: "query", required: false, schema: { type: "boolean" } },
            { name: "query", in: "query", required: false, schema: { type: "string" } },
            { name: "sort_by", in: "query", required: false, schema: { type: "string", enum: ["risk", "open_alerts", "pending_acceptance", "last_operation_at", "cost", "updated_at", "field_name"] } },
            { name: "sort_order", in: "query", required: false, schema: { type: "string", enum: ["asc", "desc"] } },
            { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 } },
            { name: "page_size", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 200, default: 20 } }
          ],
          responses: {
            "200": {
              description: "Field portfolio list returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/FieldPortfolioListResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/fields/portfolio/summary": {
        get: {
          tags: ["fields"],
          summary: "Read field portfolio summary",
          parameters: [
            { name: "tags[]", in: "query", required: false, schema: { type: "array", items: { type: "string" } }, style: "form", explode: true },
            { name: "risk_levels[]", in: "query", required: false, schema: { type: "array", items: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] } }, style: "form", explode: true },
            { name: "has_open_alerts", in: "query", required: false, schema: { type: "boolean" } }
          ],
          responses: {
            "200": {
              description: "Field portfolio summary returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/FieldPortfolioSummaryResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/fields/{field_id}": {
        put: {
          tags: ["fields"],
          summary: "Update field base info and optional polygon",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    area_ha: { type: "number" },
                    status: { type: "string" },
                    geojson: { type: "object" },
                    polygon_geojson: { type: "object" }
                  }
                }
              }
            }
          },
          responses: {
            "200": { description: "Field updated successfully" }
          }
        },
        get: {
          tags: ["fields"],
          summary: "Read field workbench detail",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Field detail returned successfully" }
          }
        }
      },
      "/api/v1/fields/{field_id}/tags": {
        get: {
          tags: ["fields"],
          summary: "Read field tags",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Field tags returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/FieldTagsResponseV1" }
                }
              }
            }
          }
        },
        post: {
          tags: ["fields"],
          summary: "Add field tag",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tag"],
                  properties: {
                    tag: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Field tag operation completed successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/FieldTagsResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/fields/{field_id}/tags/{tag}": {
        delete: {
          tags: ["fields"],
          summary: "Delete field tag",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } },
            { name: "tag", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Field tag deleted successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/FieldTagsResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/telemetry/latest": {
        get: {
          tags: ["telemetry"],
          summary: "Read latest device telemetry",
          parameters: [
            { name: "device_id", in: "query", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Latest telemetry returned successfully" }
          }
        }
      },
      "/api/v1/telemetry/series": {
        get: {
          tags: ["telemetry"],
          summary: "Read telemetry series",
          parameters: [
            { name: "device_id", in: "query", required: true, schema: { type: "string" } },
            { name: "metric_key", in: "query", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Telemetry series returned successfully" }
          }
        }
      },
      "/api/v1/alerts/rules": {
        post: {
          tags: ["alerts"],
          summary: "Create an alert rule",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertRuleRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Alert rule created successfully" }
          }
        },
        get: {
          tags: ["alerts"],
          summary: "Read alert rule list",
          responses: {
            "200": { description: "Alert rule list returned successfully" }
          }
        }
      },
      "/api/v1/alerts/events": {
        get: {
          tags: ["alerts"],
          summary: "Read alert event list",
          deprecated: true,
          responses: {
            "200": { description: "Alert event list returned successfully" }
          }
        }
      },
      "/api/v1/alerts": {
        get: {
          tags: ["alerts"],
          summary: "Read alert list",
          description: "Requires Bearer token with `alerts.read` scope.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "field_ids", in: "query", required: false, schema: { type: "string" }, description: "Comma separated field ids or repeated field_ids[] query params." },
            { name: "severity", in: "query", required: false, schema: { type: "string" }, description: "Comma separated severities: LOW,MEDIUM,HIGH,CRITICAL." },
            { name: "status", in: "query", required: false, schema: { type: "string" }, description: "Comma separated statuses: OPEN,ACKED,CLOSED." },
            { name: "category", in: "query", required: false, schema: { type: "string" } },
            { name: "object_type", in: "query", required: false, schema: { type: "string", enum: ["OPERATION", "DEVICE", "FIELD", "SYSTEM"] } },
            { name: "object_id", in: "query", required: false, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Alert list returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertListResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/summary": {
        get: {
          tags: ["alerts"],
          summary: "Read alert summary",
          description: "Requires Bearer token with `alerts.read` scope.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "field_ids", in: "query", required: false, schema: { type: "string" }, description: "Comma separated field ids or repeated field_ids[] query params." },
            { name: "severity", in: "query", required: false, schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] } },
            { name: "status", in: "query", required: false, schema: { type: "string", enum: ["OPEN", "ACKED", "CLOSED"] } },
            { name: "category", in: "query", required: false, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Alert summary returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertSummaryResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/ack": {
        post: {
          tags: ["alerts"],
          summary: "Acknowledge an alert",
          description: "Requires Bearer token with `alerts.write` scope and alert write role.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
                "application/json": {
                schema: { '$ref': "#/components/schemas/AlertAckRequestV1" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert acknowledged successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertAckResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/resolve": {
        post: {
          tags: ["alerts"],
          summary: "Resolve an alert",
          description: "Requires Bearer token with `alerts.write` scope and alert write role. In workflow mode this transitions to `RESOLVED`.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
                "application/json": {
                schema: {
                  oneOf: [
                    { '$ref': "#/components/schemas/AlertResolveRequestV1" },
                    { '$ref': "#/components/schemas/AlertWorkflowWriteRequestV1" }
                  ]
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert resolved successfully",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      { '$ref': "#/components/schemas/AlertResolveResponseV1" },
                      { '$ref': "#/components/schemas/AlertWorkflowWriteResponseV1" }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/events/{event_id}/ack": {
        post: {
          tags: ["alerts"],
          summary: "Acknowledge a legacy alert event",
          deprecated: true,
          parameters: [
            { name: "event_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Legacy endpoint acknowledged alert event" }
          }
        }
      },
      "/api/v1/alerts/events/{event_id}/close": {
        post: {
          tags: ["alerts"],
          summary: "Close a legacy alert event",
          deprecated: true,
          parameters: [
            { name: "event_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Legacy endpoint closed alert event" }
          }
        }
      },
      "/api/v1/alerts/notifications": {
        get: {
          tags: ["alerts"],
          summary: "Read alert notification records",
          description: "Requires Bearer token with `alerts.read` scope.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Alert notification records returned successfully" }
          }
        }
      },
      "/api/v1/alerts/workboard": {
        get: {
          tags: ["alerts"],
          summary: "Read alert workboard list",
          description: "Requires Bearer token with `alerts.read` scope.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "workflow_status", in: "query", required: false, schema: { type: "string" }, description: "Comma separated workflow statuses." },
            { name: "assignee_actor_id", in: "query", required: false, schema: { type: "string" }, description: "Comma separated assignee actor ids." },
            { name: "priority_min", in: "query", required: false, schema: { '$ref': "#/components/schemas/PriorityV1" } },
            { name: "priority_max", in: "query", required: false, schema: { '$ref': "#/components/schemas/PriorityV1" } },
            { name: "sla_breached", in: "query", required: false, schema: { type: "boolean" } }
          ],
          responses: {
            "200": {
              description: "Alert workboard list returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertWorkboardListResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/assign": {
        post: {
          tags: ["alerts"],
          summary: "Assign alert workflow",
          description: "Requires Bearer token with `alerts.write` scope and alert write role.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertWorkflowWriteRequestV1" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert assigned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertWorkflowWriteResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/start": {
        post: {
          tags: ["alerts"],
          summary: "Start alert workflow",
          description: "Requires Bearer token with `alerts.write` scope and alert write role.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertWorkflowWriteRequestV1" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert workflow started successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertWorkflowWriteResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/note": {
        post: {
          tags: ["alerts"],
          summary: "Add workflow note to alert",
          description: "Requires Bearer token with `alerts.write` scope and alert write role.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertWorkflowWriteRequestV1" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert workflow note updated successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertWorkflowWriteResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/{alert_id}/close": {
        post: {
          tags: ["alerts"],
          summary: "Close alert workflow",
          description: "Requires Bearer token with `alerts.write` scope and alert write role.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertWorkflowWriteRequestV1" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert workflow closed successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertWorkflowWriteResponseV1" }
                }
              }
            }
          }
        }
      },
      "/api/v1/evidence-export/jobs": {
        post: {
          tags: ["exports"],
          summary: "Create an evidence export job",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/EvidenceExportCreateRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Evidence export job created successfully" }
          }
        },
        get: {
          tags: ["exports"],
          summary: "Read evidence export job list",
          responses: {
            "200": { description: "Evidence export job list returned successfully" }
          }
        }
      },
      "/api/v1/evidence-export/jobs/{job_id}": {
        get: {
          tags: ["exports"],
          summary: "Read evidence export job detail",
          parameters: [
            { name: "job_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Evidence export job detail returned successfully" }
          }
        }
      },
      "/api/v1/evidence-export/jobs/{job_id}/download": {
        get: {
          tags: ["exports"],
          summary: "Download evidence export artifact",
          parameters: [
            { name: "job_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Evidence export artifact returned successfully" }
          }
        }
      },
      "/api/v1/dashboard/overview": {
        get: {
          tags: ["dashboard"],
          summary: "Read dashboard overview",
          responses: {
            "200": { description: "Dashboard overview returned successfully" }
          }
        }
      },
      "/api/v1/dashboard/overview_v2": {
        get: {
          tags: ["dashboard"],
          summary: "Read dashboard overview v2",
          responses: {
            "200": { description: "Dashboard overview v2 returned successfully" }
          }
        }
      },
      "/api/v1/reports/operation/{operation_id}": {
        get: {
          tags: ["operations"],
          summary: "Read frozen operation report v1 by operation id",
          parameters: [
            { name: "operation_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Operation report returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/OperationReportSingleResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/reports/field/{field_id}": {
        get: {
          tags: ["operations"],
          summary: "Read frozen operation report v1 list by field id",
          parameters: [
            { name: "field_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Field report list returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/OperationReportFieldListResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/reports/customer-dashboard/aggregate": {
        get: {
          tags: ["dashboard"],
          summary: "Read customer dashboard aggregate report",
          parameters: [
            { name: "field_ids[]", in: "query", required: false, schema: { type: "array", items: { type: "string" } } },
            { name: "time_range", in: "query", required: false, schema: { type: "string", enum: ["7d", "30d", "season"] } }
          ],
          responses: {
            "200": {
              description: "Customer dashboard aggregate returned successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/CustomerDashboardAggregateResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/ao-act/tasks/{act_task_id}/retry": {
        post: {
          tags: ["operations"],
          summary: "Retry an AO-ACT task before receipt exists",
          parameters: [
            { name: "act_task_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Retry accepted or explicitly rejected" }
          }
        }
      }
    }
  };
  return applyP13OpenApiAlignment(spec);
} // End helper.

function ref(name: string) {
  return { "$ref": `#/components/schemas/${name}` };
}

function jsonResponse(schema: any, description = "Success") {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

function pathParam(name: string, description?: string) {
  return { name, in: "path", required: true, schema: { type: "string" }, ...(description ? { description } : {}) };
}

function queryParam(name: string, schema: any, required = false) {
  return { name, in: "query", required, schema };
}

function applyP13OpenApiAlignment(spec: any) {
  const components = spec.components ?? (spec.components = {});
  const schemas = components.schemas ?? (components.schemas = {});
  Object.assign(schemas, {
    GenericOkResponse: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      additionalProperties: true,
    },
    AuthMeResponse: {
      type: "object",
      required: ["ok", "actor_id", "token_id", "tenant_id", "project_id", "group_id", "scopes"],
      properties: {
        ok: { type: "boolean" },
        actor_id: { type: "string" },
        token_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        role: { type: ["string", "null"] },
        scopes: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
    AuthLoginRequest: {
      type: "object",
      required: ["token"],
      properties: { token: { type: "string" } },
      additionalProperties: false,
    },
    AuthLoginResponse: {
      type: "object",
      required: ["ok", "token", "provider", "actor_id", "token_id", "tenant_id", "project_id", "group_id", "role", "scopes"],
      properties: {
        ok: { type: "boolean" },
        token: { type: "string" },
        provider: { type: "string" },
        actor_id: { type: "string" },
        token_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        role: { type: "string" },
        scopes: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
    ProvidersResponse: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        mode: { type: "string" },
        idp_login_url: { type: ["string", "null"] },
        idp_logout_url: { type: ["string", "null"] },
        login_path: { type: "string" },
        logout_path: { type: "string" },
      },
      additionalProperties: false,
    },
  });


  delete spec.paths["/api/v1/operations/console"];
  delete spec.paths["/api/v1/approval-requests"];
  delete spec.paths["/api/v1/approval-requests/{request_id}/approve"];

  Object.assign(schemas, {
    JsonPrimitive: { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
    PrimitiveRecord: {
      type: "object",
      additionalProperties: { oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
    },
    StringArray: { type: "array", items: { type: "string" } },
    TenantTriple: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
      },
      additionalProperties: false,
    },
    HumanIssuer: {
      type: "object",
      required: ["kind", "id", "namespace"],
      properties: {
        kind: { type: "string", enum: ["human"] },
        id: { type: "string" },
        namespace: { type: "string" },
      },
      additionalProperties: false,
    },
    TargetRef: {
      type: "object",
      required: ["kind", "ref"],
      properties: {
        kind: { type: "string", enum: ["field", "area", "path", "device"] },
        ref: { type: "string" },
      },
      additionalProperties: false,
    },
    TimeWindow: {
      type: "object",
      required: ["start_ts", "end_ts"],
      properties: {
        start_ts: { type: "number" },
        end_ts: { type: "number" },
      },
      additionalProperties: false,
    },
    ParameterSchemaKey: {
      type: "object",
      required: ["name", "type"],
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["number", "boolean", "enum"] },
        min: { type: "number" },
        max: { type: "number" },
        enum: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
    ParameterSchema: {
      type: "object",
      required: ["keys"],
      properties: { keys: { type: "array", minItems: 1, items: ref("ParameterSchemaKey") } },
      additionalProperties: false,
    },
    DeviceRef: {
      type: "object",
      required: ["kind", "ref"],
      properties: {
        kind: { type: "string", enum: ["device_ref_fact"] },
        ref: { type: "string" },
        note: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
    EvidenceLogRef: {
      type: "object",
      required: ["kind", "ref"],
      properties: { kind: { type: "string" }, ref: { type: "string" } },
      additionalProperties: false,
    },
    ExecutionActor: {
      type: "object",
      required: ["kind", "id", "namespace"],
      properties: {
        kind: { type: "string", enum: ["human", "script", "device"] },
        id: { type: "string" },
        namespace: { type: "string" },
      },
      additionalProperties: false,
    },
    ExecutionCoverage: {
      type: "object",
      required: ["kind", "ref"],
      properties: {
        kind: { type: "string", enum: ["area", "path", "field"] },
        ref: { type: "string" },
      },
      additionalProperties: false,
    },
    ResourceUsage: {
      type: "object",
      required: ["fuel_l", "electric_kwh", "water_l", "chemical_ml"],
      properties: {
        fuel_l: { type: ["number", "null"] },
        electric_kwh: { type: ["number", "null"] },
        water_l: { type: ["number", "null"] },
        chemical_ml: { type: ["number", "null"] },
      },
      additionalProperties: false,
    },
    ConstraintCheck: {
      type: "object",
      required: ["violated", "violations"],
      properties: { violated: { type: "boolean" }, violations: ref("StringArray") },
      additionalProperties: false,
    },
    EvidenceTrace: {
      type: "object",
      required: ["expected_requirements", "provided_kinds", "missing_requirements"],
      properties: {
        expected_requirements: ref("StringArray"),
        provided_kinds: ref("StringArray"),
        missing_requirements: ref("StringArray"),
      },
      additionalProperties: false,
    },
    ActionTaskRequest: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "operation_plan_id", "approval_request_id", "issuer", "action_type", "target", "time_window", "parameter_schema", "parameters", "constraints"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        operation_plan_id: { type: "string" },
        approval_request_id: { type: "string" },
        program_id: { type: "string" },
        field_id: { type: "string" },
        season_id: { type: "string" },
        issuer: ref("HumanIssuer"),
        action_type: { type: "string" },
        target: ref("TargetRef"),
        time_window: ref("TimeWindow"),
        parameter_schema: ref("ParameterSchema"),
        parameters: ref("PrimitiveRecord"),
        constraints: ref("PrimitiveRecord"),
        device_refs: { type: "array", items: ref("DeviceRef") },
        meta: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    ActionTaskResponse: {
      type: "object",
      required: ["ok", "fact_id", "act_task_id", "precheck"],
      properties: {
        ok: { type: "boolean" },
        fact_id: { type: "string" },
        act_task_id: { type: "string" },
        precheck: {
          type: "object",
          required: ["action_hints", "reason_codes", "reason_details", "source"],
          properties: {
            action_hints: ref("StringArray"),
            reason_codes: ref("StringArray"),
            reason_details: { type: "array", items: { type: "object", additionalProperties: true } },
            source: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    ActionReceiptRequest: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "operation_plan_id", "act_task_id", "executor_id", "execution_time", "execution_coverage", "resource_usage", "logs_refs", "constraint_check", "observed_parameters"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        operation_plan_id: { type: "string" },
        act_task_id: { type: "string" },
        executor_id: ref("ExecutionActor"),
        execution_time: ref("TimeWindow"),
        execution_coverage: ref("ExecutionCoverage"),
        resource_usage: ref("ResourceUsage"),
        logs_refs: { type: "array", minItems: 1, items: ref("EvidenceLogRef") },
        status: { type: "string", enum: ["executed", "not_executed"] },
        constraint_check: ref("ConstraintCheck"),
        observed_parameters: ref("PrimitiveRecord"),
        device_refs: { type: "array", items: ref("DeviceRef") },
        meta: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    ActionReceiptResponse: {
      type: "object",
      required: ["ok", "fact_id", "evidence_trace"],
      properties: {
        ok: { type: "boolean" },
        fact_id: { type: "string" },
        terminal_deduped: { type: "boolean" },
        operation_plan_transition_fact_id: { type: "string" },
        operation_plan_fact_id: { type: "string" },
        evidence_trace: ref("EvidenceTrace"),
      },
      additionalProperties: false,
    },
    ActionExecutePlan: {
      type: "object",
      required: ["action_type", "target", "parameters", "execution_mode", "safe_guard", "failure_strategy", "idempotency_key"],
      properties: {
        action_type: { type: "string" },
        target: ref("TargetRef"),
        parameters: { type: "object", minProperties: 1, additionalProperties: true },
        execution_mode: { type: "string", enum: ["AUTO", "MANUAL"] },
        safe_guard: {
          type: "object",
          required: ["requires_approval"],
          properties: { requires_approval: { type: "boolean" } },
          additionalProperties: false,
        },
        failure_strategy: {
          type: "object",
          required: ["retryable", "max_retries"],
          properties: {
            retryable: { type: "boolean" },
            max_retries: { type: "integer", minimum: 0, maximum: 5 },
            fallback_action: { type: "string" },
          },
          additionalProperties: false,
        },
        device_capability_check: {
          type: "object",
          properties: { supported: { type: "boolean" }, reason: { type: "string" } },
          required: ["supported"],
          additionalProperties: false,
        },
        time_window: {
          type: "object",
          properties: { start_ts: { type: "number" }, end_ts: { type: "number" } },
          additionalProperties: false,
        },
        idempotency_key: { type: "string" },
      },
      additionalProperties: false,
    },
    ActionExecuteRequest: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "operation_id", "execution_plan"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        operation_id: { type: "string" },
        execution_plan: ref("ActionExecutePlan"),
      },
      additionalProperties: false,
    },
    ActionExecuteResponse: {
      type: "object",
      required: ["ok"],
      properties: {
        ok: { type: "boolean" },
        act_task_id: { type: "string" },
        idempotent: { type: "boolean" },
        expected_evidence_requirements: ref("StringArray"),
        capability_resolution: { type: ["object", "null"], additionalProperties: true },
        fallback_state: { type: "object", additionalProperties: true },
        fallback_action: { type: "string" },
        error: { type: "string" },
        detail: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    OperationManualRequest: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "field_id", "action_type", "parameters", "issuer", "command_id"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        field_id: { type: "string" },
        device_id: { type: "string" },
        action_type: { type: "string" },
        adapter_type: { type: "string" },
        parameters: ref("PrimitiveRecord"),
        issuer: ref("HumanIssuer"),
        command_id: { type: "string" },
        meta: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    OperationManualResponse: {
      type: "object",
      required: ["ok", "operation_id", "operation_plan_id", "command_id"],
      properties: {
        ok: { type: "boolean" },
        operation_id: { type: "string" },
        operation_plan_id: { type: "string" },
        command_id: { type: "string" },
        reused: { type: "boolean" },
      },
      additionalProperties: false,
    },
    ApprovalRequestCreateBody: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "issuer", "action_type", "target", "time_window", "parameter_schema", "parameters", "constraints"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        field_id: { type: "string" },
        issuer: ref("HumanIssuer"),
        action_type: { type: "string" },
        target: { oneOf: [ref("TargetRef"), { type: "string" }] },
        time_window: ref("TimeWindow"),
        parameter_schema: { type: "object", additionalProperties: true },
        parameters: ref("PrimitiveRecord"),
        constraints: { type: "object", additionalProperties: true },
        meta: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    ApprovalRequestCreateResponse: {
      type: "object",
      required: ["ok", "fact_id", "request_id"],
      properties: { ok: { type: "boolean" }, fact_id: { type: "string" }, request_id: { type: "string" } },
      additionalProperties: false,
    },
    ApprovalRequestListItem: {
      type: "object",
      required: ["request_id"],
      properties: {
        request_id: { type: "string" }, tenant_id: { type: ["string", "null"] }, project_id: { type: ["string", "null"] }, group_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, status: { type: ["string", "null"] },
        target: { type: "object", properties: { device_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] } }, additionalProperties: false },
        parameters: { type: "object", properties: { amount_mm: { type: ["number", "null"] }, duration_sec: { type: ["number", "null"] } }, additionalProperties: false },
        constraints: { type: "object", properties: { requires_online_device: { type: ["boolean", "null"] }, requires_recent_telemetry: { type: ["boolean", "null"] } }, additionalProperties: false },
        created_at_ts: { type: ["number", "null"] },
      },
      additionalProperties: false,
    },

    ApprovalRequestListResponse: {
      type: "object",
      required: ["ok", "items"],
      properties: { ok: { type: "boolean" }, items: { type: "array", items: ref("ApprovalRequestListItem") } },
      additionalProperties: false,
    },
    ApprovalApproveBody: {
      type: "object",
      required: ["tenant_id", "project_id", "group_id", "request_id", "approved"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        request_id: { type: "string" },
        approved: { type: "boolean" },
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
    ApprovalApproveResponse: {
      type: "object",
      required: ["ok", "request_id", "decision_id", "decision_fact_id"],
      properties: {
        ok: { type: "boolean" },
        request_id: { type: "string" },
        decision_id: { type: "string" },
        act_task_id: { type: "string" },
        ao_act_fact_id: { type: "string" },
        decision_fact_id: { type: "string" },
      },
      additionalProperties: false,
    },
    RecommendationGenerateBody: {
      type: "object",
      required: ["device_id", "field_id"],
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        device_id: { type: "string" },
        field_id: { type: "string" },
        crop_code: { type: "string" },
      },
      additionalProperties: false,
    },
    RecommendationGenerateResponse: { type: "object", required: ["ok", "recommendations", "fact_ids"], properties: { ok: { type: "boolean" }, recommendations: { type: "array", items: { type: "object", properties: { recommendation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, recommendation_type: { type: ["string", "null"] }, title: { type: ["string", "null"] } }, additionalProperties: false } }, fact_ids: { type: "array", items: { type: "string" } } }, additionalProperties: false },

    RecommendationSubmitApprovalBody: {
      type: "object",
      properties: {
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
      },
      additionalProperties: false,
    },
    RecommendationSubmitApprovalResponse: {
      type: "object",
      required: ["ok", "recommendation_id", "approval_request_id", "approval_fact_id", "mapping_fact_id", "operation_plan_id", "operation_plan_fact_id"],
      properties: {
        ok: { type: "boolean" },
        recommendation_id: { type: "string" },
        approval_request_id: { type: "string" },
        approval_fact_id: { type: "string" },
        mapping_fact_id: { type: "string" },
        operation_plan_id: { type: "string" },
        operation_plan_fact_id: { type: "string" },
      },
      additionalProperties: false,
    },
    DeviceUpsertRequest: {
      type: "object",
      required: ["device_template"],
      properties: {
        device_id: { type: "string" },
        display_name: { type: "string" },
        device_mode: { type: "string", enum: ["real", "simulator"] },
        device_template: { type: "string" },
        template_code: { type: "string" },
      },
      additionalProperties: false,
    },
    DeviceSkillBindingSummary: {
      type: "object",
      required: ["skill_id", "version", "category", "status", "bind_target", "trigger_stage"],
      properties: {
        skill_id: { type: "string" },
        version: { type: "string" },
        category: { type: "string" },
        status: { type: "string" },
        bind_target: { type: "string" },
        trigger_stage: { type: "string" },
      },
      additionalProperties: false,
    },

    DeviceUpsertResponse: {
      type: "object",
      required: ["ok", "tenant_id", "device_id", "device_mode", "device_template", "template_code", "fact_id", "skill_bindings"],
      properties: {
        ok: { type: "boolean" },
        tenant_id: { type: "string" },
        device_id: { type: "string" },
        display_name: { type: ["string", "null"] },
        device_mode: { type: "string" },
        device_template: { type: "string" },
        template_code: { type: "string" },
        fact_id: { type: "string" },
        skill_bindings: { type: "array", items: ref("DeviceSkillBindingSummary") },
      },
      additionalProperties: false,
    },
    DevicesListItem: {
      type: "object",
      required: ["device_id", "display_name", "device_mode", "device_template", "last_credential_id", "last_credential_status", "telemetry_status", "last_telemetry_ts_ms"],
      properties: {
        device_id: { type: "string" },
        display_name: { type: ["string", "null"] },
        device_mode: { type: "string" },
        device_template: { type: ["string", "null"] },
        last_credential_id: { type: ["string", "null"] },
        last_credential_status: { type: ["string", "null"] },
        telemetry_status: { type: ["string", "null"] },
        last_telemetry_ts_ms: { type: ["number", "null"] },
        field_id: { type: ["string", "null"] },
        field_name: { type: ["string", "null"] },
        bound_ts_ms: { type: ["number", "null"] },
        last_heartbeat_ts_ms: { type: ["number", "null"] },
        battery_percent: { type: ["number", "null"] },
        rssi_dbm: { type: ["number", "null"] },
        fw_ver: { type: ["string", "null"] },
        binding_status: { type: ["string", "null"] },
        missing_required_observation_skills: { type: "array", items: { type: "string" } },
        connection_status: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },

    DevicesListResponse: {
      type: "object",
      required: ["ok", "devices"],
      properties: { ok: { type: "boolean" }, devices: { type: "array", items: ref("DevicesListItem") } },
      additionalProperties: false,
    },
    DeviceDetailResponse: {
      type: "object",
      required: ["ok", "item"],
      properties: {
        ok: { type: "boolean" },
        item: {
          type: ["object", "null"],
          properties: {
            device_id: { type: "string" }, tenant_id: { type: ["string", "null"] }, display_name: { type: ["string", "null"] }, device_mode: { type: ["string", "null"] }, created_ts_ms: { type: ["number", "null"] },
            last_credential_id: { type: ["string", "null"] }, last_credential_status: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, field_name: { type: ["string", "null"] },
            last_telemetry_ts_ms: { type: ["number", "null"] }, last_heartbeat_ts_ms: { type: ["number", "null"] }, battery_percent: { type: ["number", "null"] }, rssi_dbm: { type: ["number", "null"] }, fw_ver: { type: ["string", "null"] },
            connection_status: { type: ["string", "null"] }, binding_status: { type: ["string", "null"] }, missing_required_observation_skills: { type: "array", items: { type: "string" } },
            access_info: { type: "object", properties: { device_id: { type: "string" }, tenant_id: { type: "string" }, mqtt_client_id: { type: "string" }, telemetry_topic: { type: "string" }, heartbeat_topic: { type: "string" }, downlink_topic: { type: "string" }, receipt_topic: { type: "string" }, cmd_topic: { type: "string" }, ack_topic: { type: "string" }, payload_contract_version: { type: "string" }, auth_mode: { type: "string" }, secret_warning: { type: "string" } }, additionalProperties: false },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },

    DeviceCredentialIssueRequest: {
      type: "object",
      properties: { credential_id: { type: "string" } },
      additionalProperties: false,
    },
    DeviceCredentialIssueResponse: {
      type: "object",
      required: ["ok", "tenant_id", "device_id", "credential_id", "credential_secret", "credential_hash", "fact_id", "access_info"],
      properties: {
        ok: { type: "boolean" }, tenant_id: { type: "string" }, device_id: { type: "string" }, credential_id: { type: "string" }, credential_secret: { type: "string" }, credential_hash: { type: "string" }, fact_id: { type: "string" },
        access_info: { type: "object", properties: { device_id: { type: "string" }, tenant_id: { type: "string" }, mqtt_client_id: { type: "string" }, telemetry_topic: { type: "string" }, heartbeat_topic: { type: "string" }, downlink_topic: { type: "string" }, receipt_topic: { type: "string" }, cmd_topic: { type: "string" }, ack_topic: { type: "string" }, payload_contract_version: { type: "string" }, auth_mode: { type: "string" }, secret_warning: { type: "string" } }, additionalProperties: false }
      },
      additionalProperties: false,
    },

    DeviceCredentialRevokeRequest: { type: "object", properties: {}, additionalProperties: false },
    DeviceCredentialRevokeResponse: {
      type: "object",
      required: ["ok", "tenant_id", "device_id", "credential_id", "fact_id", "revoked_ts_ms"],
      properties: { ok: { type: "boolean" }, tenant_id: { type: "string" }, device_id: { type: "string" }, credential_id: { type: "string" }, fact_id: { type: "string" }, revoked_ts_ms: { type: "number" } },
      additionalProperties: false,
    },
    DeviceCapabilitiesRequest: {
      type: "object",
      required: ["capabilities"],
      properties: { capabilities: { type: "array", items: { type: "string", enum: ["irrigation", "valve"] } } },
      additionalProperties: false,
    },
    DeviceCapabilitiesResponse: {
      type: "object",
      required: ["ok", "tenant_id", "device_id", "capabilities", "updated_ts_ms"],
      properties: { ok: { type: "boolean" }, tenant_id: { type: "string" }, device_id: { type: "string" }, capabilities: { type: "array", items: { type: "string" } }, updated_ts_ms: { type: "number" }, fact_id: { type: "string" } },
      additionalProperties: false,
    },
    DeviceSkillBindingsReconcileRequest: { type: "object", properties: {}, additionalProperties: false },
    DeviceSkillBindingsReconcileResponse: {
      type: "object",
      required: ["ok", "device_id", "binding_status", "missing_required_observation_skills"],
      properties: { ok: { type: "boolean" }, device_id: { type: "string" }, binding_status: { type: ["string", "null"] }, missing_required_observation_skills: { type: "array", items: { type: "string" } }, fact_id: { type: ["string", "null"] } },
      additionalProperties: false,
    },

    DeviceOnboardingStatusResponse: {
      type: "object",
      required: ["ok", "tenant_id", "device_id", "display_name", "device_mode", "registration_completed", "credential_ready", "first_telemetry_uploaded", "created_ts_ms", "last_credential_id", "last_credential_status", "last_heartbeat_ts_ms", "last_telemetry_ts_ms", "access_info"],
      properties: {
        ok: { type: "boolean" }, tenant_id: { type: "string" }, device_id: { type: "string" }, display_name: { type: ["string", "null"] }, device_mode: { type: "string" }, registration_completed: { type: "boolean" }, credential_ready: { type: "boolean" }, first_telemetry_uploaded: { type: "boolean" }, created_ts_ms: { type: ["number", "null"] }, last_credential_id: { type: ["string", "null"] }, last_credential_status: { type: ["string", "null"] }, last_heartbeat_ts_ms: { type: ["number", "null"] }, last_telemetry_ts_ms: { type: ["number", "null"] }, access_info: { type: "object", additionalProperties: true }
      },
      additionalProperties: false,
    },
    SenseSubjectRef: {
      type: "object",
      required: ["projectId", "groupId"],
      properties: { projectId: { type: "string" }, groupId: { type: "string" } },
      additionalProperties: false,
    },
    SenseWindow: {
      type: "object",
      required: ["startTs", "endTs"],
      properties: { startTs: { type: "integer" }, endTs: { type: "integer" } },
      additionalProperties: false,
    },
    SenseTaskRequest: {
      type: "object",
      required: ["subjectRef", "window", "priority", "supporting_problem_state_id", "supporting_determinism_hash", "supporting_effective_config_hash"],
      properties: {
        subjectRef: ref("SenseSubjectRef"),
        window: ref("SenseWindow"),
        sense_kind: { type: "string" },
        sense_focus: { type: "string" },
        kind: { type: "string" },
        focus: { type: "string" },
        priority: { type: "string" },
        supporting_problem_state_id: { type: "string" },
        supporting_determinism_hash: { type: "string" },
        supporting_effective_config_hash: { type: "string" },
      },
      additionalProperties: false,
    },
    SenseTaskResponse: { type: "object", required: ["ok", "task_id", "fact_id"], properties: { ok: { type: "boolean" }, task_id: { type: "string" }, fact_id: { type: "string" } }, additionalProperties: false },
    SenseEvidenceRef: { type: "object", required: ["kind", "ref_id"], properties: { kind: { type: "string", enum: ["raw_sample_v1", "marker_v1", "import_run_v1", "fact_id"] }, ref_id: { type: "string" } }, additionalProperties: false },
    SenseReceiptRequest: {
      type: "object",
      required: ["task_id", "executed_at_ts", "result", "evidence_refs"],
      properties: {
        task_id: { type: "string" },
        executed_at_ts: { type: "integer" },
        result: { type: "string", enum: ["success", "fail", "partial"] },
        evidence_refs: { type: "array", minItems: 1, items: ref("SenseEvidenceRef") },
      },
      additionalProperties: false,
    },
    SenseReceiptResponse: { type: "object", required: ["ok", "receipt_id", "fact_id"], properties: { ok: { type: "boolean" }, receipt_id: { type: "string" }, fact_id: { type: "string" } }, additionalProperties: false },
    SenseTasksResponse: { type: "object", required: ["ok", "items"], properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { task_id: { type: "string" }, subject_ref: ref("SenseSubjectRef"), window: ref("SenseWindow"), sense_kind: { type: ["string", "null"] }, sense_focus: { type: ["string", "null"] }, priority: { type: ["string", "null"] }, status: { type: ["string", "null"] }, occurred_at: { type: ["string", "null"] } }, additionalProperties: false } } }, additionalProperties: false },

    SenseReceiptsResponse: { type: "object", required: ["ok", "items"], properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { receipt_id: { type: "string" }, task_id: { type: ["string", "null"] }, result: { type: ["string", "null"] }, executed_at_ts: { type: ["integer", "null"] }, occurred_at: { type: ["string", "null"] } }, additionalProperties: false } } }, additionalProperties: false },

    SenseNextTaskResponse: { type: "object", required: ["ok", "item"], properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], properties: { task_id: { type: "string" }, subject_ref: ref("SenseSubjectRef"), window: ref("SenseWindow"), sense_kind: { type: ["string", "null"] }, sense_focus: { type: ["string", "null"] }, priority: { type: ["string", "null"] }, status: { type: ["string", "null"] }, occurred_at: { type: ["string", "null"] } }, additionalProperties: false } }, additionalProperties: false },

    SkillBindingCreateRequest: {
      type: "object",
      required: ["skill_id", "version", "category", "bind_target"],
      properties: {
        tenant_id: { type: "string" }, project_id: { type: "string" }, group_id: { type: "string" }, binding_id: { type: "string" }, skill_id: { type: "string" }, version: { type: "string" }, category: { type: "string" }, enabled: { type: "boolean" }, scope_type: { type: "string" }, trigger_stage: { type: "string" }, bind_target: { type: "string" }, rollout_mode: { type: "string" }, crop_code: { type: "string" }, device_type: { type: "string" }, priority: { type: "number" }, config_patch: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    SkillBindingWriteResponse: {
      type: "object",
      required: ["ok", "fact_id", "occurred_at", "binding", "api_contract_version"],
      properties: {
        ok: { type: "boolean" }, fact_id: { type: "string" }, occurred_at: { type: "string" }, api_contract_version: { type: "string" },
        binding: { type: "object", properties: { binding_id: { type: ["string", "null"] }, skill_id: { type: "string" }, version: { type: "string" }, category: { type: "string" }, status: { type: ["string", "null"] }, scope_type: { type: ["string", "null"] }, rollout_mode: { type: ["string", "null"] }, trigger_stage: { type: ["string", "null"] }, bind_target: { type: "string" }, crop_code: { type: ["string", "null"] }, device_type: { type: ["string", "null"] }, priority: { type: ["number", "null"] } }, additionalProperties: false }
      },
      additionalProperties: false,
    },

    SkillBindingOverrideRequest: {
      type: "object",
      required: ["skill_id", "version", "category", "bind_target"],
      properties: {
        tenant_id: { type: "string" }, project_id: { type: "string" }, group_id: { type: "string" }, binding_id: { type: "string" }, skill_id: { type: "string" }, version: { type: "string" }, category: { type: "string" }, enabled: { type: "boolean" }, scope_type: { type: "string" }, trigger_stage: { type: "string" }, bind_target: { type: "string" }, rollout_mode: { type: "string" }, crop_code: { type: "string" }, device_type: { type: "string" }, priority: { type: "number" }, config_patch: { type: "object", additionalProperties: true },
      },
      additionalProperties: false,
    },
    SkillsListResponse: {
      type: "object",
      required: ["ok", "page", "page_size", "total", "items", "api_contract_version"],
      properties: { ok: { type: "boolean" }, page: { type: "integer" }, page_size: { type: "integer" }, total: { type: "integer" }, api_contract_version: { type: "string" }, items: { type: "array", items: { type: "object", properties: { skill_id: { type: "string" }, version: { type: "string" }, display_name: { type: ["string", "null"] }, category: { type: ["string", "null"] }, legacy_category: { type: ["string", "null"] }, skill_type: { type: ["string", "null"] }, status: { type: ["string", "null"] }, trigger_stage: { type: ["string", "null"] }, scope_type: { type: ["string", "null"] }, rollout_mode: { type: ["string", "null"] }, crop_code: { type: ["string", "null"] }, device_type: { type: ["string", "null"] }, binding_status: { type: ["string", "null"] } }, additionalProperties: false } } },
      additionalProperties: false,
    },

    SkillDetailResponse: { type: "object", properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], additionalProperties: true }, api_contract_version: { type: "string" } }, required: ["ok", "item", "api_contract_version"], additionalProperties: false },
    SkillBindingsResponse: { type: "object", properties: { ok: { type: "boolean" }, items_effective: { type: "array", items: { type: "object", properties: { binding_id: { type: ["string", "null"] }, skill_id: { type: "string" }, version: { type: "string" }, category: { type: ["string", "null"] }, status: { type: ["string", "null"] }, scope_type: { type: ["string", "null"] }, rollout_mode: { type: ["string", "null"] }, trigger_stage: { type: ["string", "null"] }, bind_target: { type: ["string", "null"] }, crop_code: { type: ["string", "null"] }, device_type: { type: ["string", "null"] }, priority: { type: ["number", "null"] } }, additionalProperties: false } }, items_history: { type: "array", items: { type: "object", properties: { binding_id: { type: ["string", "null"] }, skill_id: { type: "string" }, version: { type: "string" }, category: { type: ["string", "null"] }, status: { type: ["string", "null"] }, occurred_at: { type: ["string", "null"] }, bind_target: { type: ["string", "null"] } }, additionalProperties: false } }, overrides: { type: "array", items: { type: "object", properties: { binding_id: { type: ["string", "null"] }, skill_id: { type: "string" }, version: { type: "string" }, status: { type: ["string", "null"] }, bind_target: { type: ["string", "null"] } }, additionalProperties: false } }, api_contract_version: { type: "string" } }, required: ["ok", "items_effective", "items_history", "overrides", "api_contract_version"], additionalProperties: false },

    SkillRunsResponse: { type: "object", properties: { ok: { type: "boolean" }, page: { type: "integer" }, page_size: { type: "integer" }, total: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { run_id: { type: "string" }, operation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, skill_id: { type: ["string", "null"] }, version: { type: ["string", "null"] }, category: { type: ["string", "null"] }, bind_target: { type: ["string", "null"] }, trigger_stage: { type: ["string", "null"] }, result_status: { type: ["string", "null"] }, occurred_at: { type: ["string", "null"] } }, additionalProperties: false } }, api_contract_version: { type: "string" } }, required: ["ok", "page", "page_size", "total", "items", "api_contract_version"], additionalProperties: false },

    OperationListResponse: { type: "object", properties: { ok: { type: "boolean" }, count: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { operation_id: { type: ["string", "null"] }, operation_plan_id: { type: ["string", "null"] }, recommendation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, final_status: { type: ["string", "null"] }, title: { type: ["string", "null"] }, created_at: { type: ["string", "null"] }, updated_at: { type: ["string", "null"] }, expected_effect: { type: ["string", "null"] } }, additionalProperties: false } }, recommendation_states: { type: "array", items: { type: "object", properties: { recommendation_id: { type: ["string", "null"] }, operation_id: { type: ["string", "null"] }, status: { type: ["string", "null"] } }, additionalProperties: false } }, device_states: { type: "array", items: { type: "object", properties: { device_id: { type: ["string", "null"] }, status: { type: ["string", "null"] }, last_telemetry_ts_ms: { type: ["number", "null"] } }, additionalProperties: false } } }, required: ["ok", "count", "items", "recommendation_states", "device_states"], additionalProperties: false },

    OperationDetailResponse: { type: "object", properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], properties: { operation_id: { type: ["string", "null"] }, operation_plan_id: { type: ["string", "null"] }, recommendation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, final_status: { type: ["string", "null"] }, title: { type: ["string", "null"] }, expected_effect: { type: ["string", "null"] }, report_json: { type: ["object", "null"], properties: { type: { type: ["string", "null"] }, summary: { type: ["string", "null"] }, root_cause: { type: ["string", "null"] }, risk: { type: ["string", "null"] }, recommendation: { type: ["string", "null"] }, evidence_refs: { type: "array", items: { type: "string" } } }, additionalProperties: false } }, additionalProperties: false } }, required: ["ok", "item"], additionalProperties: false },

    OperationEvidenceResponse: { type: "object", properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], properties: { operation_plan_id: { type: ["string", "null"] }, operation_id: { type: ["string", "null"] }, recommendation: { type: ["object", "null"], properties: { recommendation_id: { type: ["string", "null"] }, title: { type: ["string", "null"] }, status: { type: ["string", "null"] } }, additionalProperties: false }, approval_decision: { type: ["object", "null"], properties: { decision_id: { type: ["string", "null"] }, approved: { type: ["boolean", "null"] }, reason: { type: ["string", "null"] } }, additionalProperties: false }, operation_plan: { type: ["object", "null"], properties: { operation_plan_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, status: { type: ["string", "null"] } }, additionalProperties: false }, task: { type: ["object", "null"], properties: { task_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, device_id: { type: ["string", "null"] } }, additionalProperties: false }, receipt: { type: ["object", "null"], properties: { receipt_id: { type: ["string", "null"] }, status: { type: ["string", "null"] }, device_id: { type: ["string", "null"] } }, additionalProperties: false }, acceptance: { type: ["object", "null"], properties: { verdict: { type: ["string", "null"] }, missing_evidence: { type: ["boolean", "null"] } }, additionalProperties: false } }, additionalProperties: false } }, required: ["ok", "item"], additionalProperties: false },

    OperationDetailPageResponse: { type: "object", properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], properties: { operation: { type: ["object", "null"], properties: { operation_id: { type: ["string", "null"] }, operation_plan_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, final_status: { type: ["string", "null"] } }, additionalProperties: false }, recommendation: { type: ["object", "null"], properties: { recommendation_id: { type: ["string", "null"] }, title: { type: ["string", "null"] }, subtitle: { type: ["string", "null"] } }, additionalProperties: false }, approval: { type: ["object", "null"], properties: { request_id: { type: ["string", "null"] }, decision_id: { type: ["string", "null"] }, approved: { type: ["boolean", "null"] } }, additionalProperties: false }, execution: { type: ["object", "null"], properties: { task_id: { type: ["string", "null"] }, receipt_id: { type: ["string", "null"] }, executor_label: { type: ["string", "null"] } }, additionalProperties: false }, acceptance: { type: ["object", "null"], properties: { verdict: { type: ["string", "null"] }, missing_evidence: { type: ["boolean", "null"] } }, additionalProperties: false }, timeline: { type: "array", items: { type: "object", properties: { id: { type: ["string", "null"] }, type: { type: ["string", "null"] }, title: { type: ["string", "null"] }, ts_label: { type: ["string", "null"] } }, additionalProperties: false } } }, additionalProperties: false } }, required: ["ok", "item"], additionalProperties: false },

    ActionIndexResponse: { type: "object", properties: { ok: { type: "boolean" }, rows: { type: "array", items: { type: "object", properties: { act_task_id: { type: ["string", "null"] }, action_type: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, state: { type: ["string", "null"] }, ts_ms: { type: ["number", "null"] } }, additionalProperties: false } }, note: { type: "string" } }, required: ["ok", "rows", "note"], additionalProperties: false },

    RecommendationsListResponse: { type: "object", properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { recommendation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, title: { type: ["string", "null"] }, recommendation_type: { type: ["string", "null"] }, status: { type: ["string", "null"] } }, additionalProperties: false } }, count: { type: "integer" }, summary: { type: "object", properties: { total: { type: ["integer", "null"] }, pending: { type: ["integer", "null"] }, approved: { type: ["integer", "null"] }, rejected: { type: ["integer", "null"] } }, additionalProperties: false } }, required: ["ok"], additionalProperties: false },

    RecommendationDetailResponse: { type: "object", properties: { ok: { type: "boolean" }, item: { type: ["object", "null"], properties: { recommendation_id: { type: ["string", "null"] }, field_id: { type: ["string", "null"] }, device_id: { type: ["string", "null"] }, title: { type: ["string", "null"] }, recommendation_type: { type: ["string", "null"] }, status: { type: ["string", "null"] }, latest_derived_sensing_states: { type: "array", items: { type: "object", properties: { key: { type: ["string", "null"] }, value: { type: ["string", "number", "boolean", "null"] } }, additionalProperties: false } } }, additionalProperties: false } }, required: ["ok", "item"], additionalProperties: false },

    RecommendationControlPlaneResponse: { type: "object", properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { recommendation_id: { type: ["string", "null"] }, title: { type: ["string", "null"] }, status: { type: ["string", "null"] }, action_type: { type: ["string", "null"] } }, additionalProperties: false } }, summary: { type: "object", properties: { total: { type: ["integer", "null"] }, actionable: { type: ["integer", "null"] } }, additionalProperties: false } }, required: ["ok"], additionalProperties: false },

    PrescriptionContractV1: {
      type: "object",
      required: ["prescription_id", "recommendation_id", "tenant_id", "project_id", "group_id", "field_id", "operation_type", "spatial_scope", "timing_window", "operation_amount", "device_requirements", "risk", "evidence_refs", "approval_requirement", "acceptance_conditions", "status", "created_at", "updated_at"],
      properties: {
        prescription_id: { type: "string" },
        recommendation_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        field_id: { type: "string" },
        season_id: { type: ["string", "null"] },
        crop_id: { type: ["string", "null"] },
        zone_id: { type: ["string", "null"] },
        operation_type: { type: "string", enum: ["IRRIGATION", "FERTILIZATION", "SPRAYING", "INSPECTION", "SAMPLING", "OTHER"] },
        spatial_scope: { type: "object", additionalProperties: true },
        timing_window: { type: "object", additionalProperties: true },
        operation_amount: { type: "object", required: ["amount", "unit"], properties: { amount: { type: "number" }, unit: { type: "string" } }, additionalProperties: true },
        device_requirements: { type: "object", additionalProperties: true },
        risk: { type: "object", required: ["level", "reasons"], properties: { level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, reasons: { type: "array", items: { type: "string" } } }, additionalProperties: false },
        evidence_refs: { type: "array", items: { type: "string" } },
        approval_requirement: { type: "object", required: ["required"], properties: { required: { type: "boolean" }, role: { type: ["string", "null"] } }, additionalProperties: true },
        acceptance_conditions: { type: "object", required: ["evidence_required"], properties: { evidence_required: { type: "array", items: { type: "string" } } }, additionalProperties: true },
        status: { type: "string", enum: ["DRAFT", "READY_FOR_APPROVAL", "APPROVAL_REQUESTED", "APPROVED", "REJECTED", "TASK_CREATED", "CANCELLED"] },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
        created_by: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
    PrescriptionFromRecommendationRequest: {
      type: "object",
      required: ["recommendation_id", "tenant_id", "project_id", "group_id", "field_id"],
      properties: {
        recommendation_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        field_id: { type: "string" },
        season_id: { type: ["string", "null"] },
        crop_id: { type: ["string", "null"] },
        zone_id: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
    PrescriptionFromRecommendationResponse: {
      type: "object",
      required: ["ok", "idempotent", "prescription"],
      properties: {
        ok: { type: "boolean" },
        idempotent: { type: "boolean" },
        prescription: ref("PrescriptionContractV1"),
      },
      additionalProperties: false,
    },
    PrescriptionReadResponse: {
      type: "object",
      required: ["ok", "prescription"],
      properties: {
        ok: { type: "boolean" },
        prescription: ref("PrescriptionContractV1"),
      },
      additionalProperties: false,
    },
    PrescriptionSubmitApprovalResponse: {
      type: "object",
      required: ["ok", "prescription_id", "approval_request_id", "prescription"],
      properties: {
        ok: { type: "boolean" },
        prescription_id: { type: "string" },
        approval_request_id: { type: "string" },
        prescription: ref("PrescriptionContractV1"),
      },
      additionalProperties: false,
    },


    AsExecutedRecordV1: {
      type: "object",
      required: ["as_executed_id", "tenant_id", "project_id", "group_id", "task_id", "receipt_id", "executor", "planned", "executed", "deviation", "evidence_refs", "receipt_refs", "log_refs", "confidence", "created_at", "updated_at"],
      properties: {
        as_executed_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        task_id: { type: "string" },
        receipt_id: { type: "string" },
        prescription_id: { type: ["string", "null"] },
        field_id: { type: ["string", "null"] },
        executor: { type: "object", additionalProperties: true },
        planned: { type: "object", additionalProperties: true },
        executed: { type: "object", additionalProperties: true },
        deviation: { type: "object", additionalProperties: true },
        evidence_refs: { type: "array", items: {} },
        receipt_refs: { type: "array", items: {} },
        log_refs: { type: "array", items: {} },
        confidence: { type: "object", additionalProperties: true },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
      additionalProperties: true,
    },
    AsAppliedMapV1: {
      type: "object",
      required: ["as_applied_id", "tenant_id", "project_id", "group_id", "task_id", "receipt_id", "prescription_id", "geometry", "coverage", "application", "evidence_refs", "log_refs", "created_at", "updated_at"],
      properties: {
        as_applied_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        field_id: { type: ["string", "null"] },
        zone_id: { type: ["string", "null"] },
        task_id: { type: "string" },
        receipt_id: { type: "string" },
        prescription_id: { type: "string" },
        geometry: { type: "object", additionalProperties: true },
        coverage: { type: "object", additionalProperties: true },
        application: { type: "object", additionalProperties: true },
        evidence_refs: { type: "array", items: {} },
        log_refs: { type: "array", items: {} },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
      additionalProperties: true,
    },
    AsExecutedFromReceiptRequest: {
      type: "object",
      required: ["task_id", "receipt_id", "tenant_id", "project_id", "group_id"],
      properties: {
        task_id: { type: "string" },
        receipt_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
      },
      additionalProperties: false,
    },
    AsExecutedFromReceiptResponse: {
      type: "object",
      required: ["ok", "as_executed", "as_applied", "idempotent"],
      properties: {
        ok: { type: "boolean" },
        as_executed: ref("AsExecutedRecordV1"),
        as_applied: ref("AsAppliedMapV1"),
        idempotent: { type: "boolean" },
      },
      additionalProperties: false,
    },

    RoiLedgerV1: {
      type: "object",
      required: ["roi_ledger_id", "tenant_id", "project_id", "group_id", "roi_type", "baseline", "actual", "delta", "confidence", "evidence_refs", "calculation_method", "created_at", "updated_at"],
      properties: {
        roi_ledger_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        operation_id: { type: ["string", "null"] },
        task_id: { type: ["string", "null"] },
        prescription_id: { type: ["string", "null"] },
        as_executed_id: { type: ["string", "null"] },
        as_applied_id: { type: ["string", "null"] },
        field_id: { type: ["string", "null"] },
        season_id: { type: ["string", "null"] },
        zone_id: { type: ["string", "null"] },
        roi_type: { type: "string" },
        baseline: { type: "object", additionalProperties: true },
        actual: { type: "object", additionalProperties: true },
        delta: { type: "object", additionalProperties: true },
        confidence: {
          type: "object",
          required: ["level", "basis", "reasons"],
          properties: {
            level: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            basis: { type: "string", enum: ["measured", "estimated", "assumed"] },
            reasons: { type: "array", items: { type: "string" } },
          },
          additionalProperties: true,
        },
        evidence_refs: { type: "array", items: {} },
        calculation_method: { type: "string" },
        assumptions: { type: "object", additionalProperties: true },
        uncertainty_notes: { type: ["string", "null"] },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
      additionalProperties: true,
    },
    RoiLedgerFromAsExecutedRequest: {
      type: "object",
      required: ["as_executed_id", "tenant_id", "project_id", "group_id"],
      properties: {
        as_executed_id: { type: "string" },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
      },
      additionalProperties: false,
    },
    RoiLedgerFromAsExecutedResponse: {
      type: "object",
      required: ["ok", "idempotent", "roi_ledgers"],
      properties: {
        ok: { type: "boolean" },
        idempotent: { type: "boolean" },
        roi_ledgers: { type: "array", items: ref("RoiLedgerV1") },
      },
      additionalProperties: false,
    },
    RulePerformanceResponse: { type: "object", properties: { ok: { type: "boolean" }, items: { type: "array", items: { type: "object", properties: { rule_id: { type: ["string", "null"] }, execution_count: { type: ["integer", "null"] }, success_count: { type: ["integer", "null"] }, failure_count: { type: ["integer", "null"] }, avg_duration_ms: { type: ["number", "null"] } }, additionalProperties: false } }, item: { type: ["object", "null"], properties: { rule_id: { type: ["string", "null"] }, execution_count: { type: ["integer", "null"] }, success_count: { type: ["integer", "null"] }, failure_count: { type: ["integer", "null"] }, avg_duration_ms: { type: ["number", "null"] } }, additionalProperties: false } }, required: ["ok"], additionalProperties: false },

  });

  Object.assign(spec.components.schemas, {
    JudgeResultV2: {
      type: "object",
      required: ["judge_id", "judge_kind", "tenant_id", "project_id", "group_id", "verdict", "severity", "reasons", "inputs", "outputs", "confidence", "evidence_refs", "source_refs", "created_at", "created_ts_ms"],
      properties: {
        judge_id: { type: "string" },
        judge_kind: { type: "string", enum: ["EVIDENCE", "AGRONOMY", "EXECUTION"] },
        tenant_id: { type: "string" },
        project_id: { type: "string" },
        group_id: { type: "string" },
        verdict: { type: "string" },
        severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        reasons: { type: "array", items: { type: "string" } },
        inputs: { type: "object", additionalProperties: true },
        outputs: { type: "object", additionalProperties: true },
        confidence: { type: "object", additionalProperties: true },
        evidence_refs: { type: "array", items: {} },
        source_refs: { type: "array", items: {} },
        created_at: { type: "string", format: "date-time" },
        created_ts_ms: { type: "integer", format: "int64" },
      },
      additionalProperties: true,
    },
  });


  Object.assign(spec.paths, {
    "/api/v1/actions/index": {
      get: { tags: ["operations"], summary: "Read AO-ACT task index", parameters: [queryParam("tenant_id", { type: "string" }), queryParam("project_id", { type: "string" }), queryParam("group_id", { type: "string" }), queryParam("status", { type: "string" })], responses: { "200": jsonResponse(ref("ActionIndexResponse"), "AO-ACT task index") } }
    },
    "/api/v1/operations": {
      get: { tags: ["operations"], summary: "List operations", responses: { "200": jsonResponse(ref("OperationListResponse"), "Operations list") } }
    },
    "/api/v1/operations/{operation_id}": {
      get: { tags: ["operations"], summary: "Read operation summary", parameters: [pathParam("operation_id")], responses: { "200": jsonResponse(ref("OperationDetailResponse"), "Operation summary") } }
    },
    "/api/v1/operations/{operation_id}/evidence": {
      get: { tags: ["operations"], summary: "Read operation evidence bundle", parameters: [pathParam("operation_id")], responses: { "200": jsonResponse(ref("OperationEvidenceResponse"), "Operation evidence") } }
    },
    "/api/v1/operations/{operationPlanId}/detail": {
      get: { tags: ["operations"], summary: "Read operation detail page model", parameters: [pathParam("operationPlanId")], responses: { "200": jsonResponse(ref("OperationDetailPageResponse"), "Operation detail page model") } }
    },
    "/api/v1/operations/{operationPlanId}/evidence-export": {
      get: { tags: ["operations"], summary: "Export operation evidence package", parameters: [pathParam("operationPlanId")], responses: { "200": jsonResponse(ref("GenericOkResponse"), "Operation evidence export") } }
    },
    "/api/v1/skills/registry": {
      get: { tags: ["operations"], summary: "Legacy skills registry redirect", deprecated: true, responses: { "301": jsonResponse(ref("GenericOkResponse"), "Redirect to /api/v1/skills") } }
    },
    "/api/v1/skills": {
      get: { tags: ["operations"], summary: "List skills", responses: { "200": jsonResponse(ref("SkillsListResponse"), "Skills list") } }
    },
    "/api/v1/skills/{skill_id}": {
      get: { tags: ["operations"], summary: "Read skill detail", parameters: [pathParam("skill_id")], responses: { "200": jsonResponse(ref("SkillDetailResponse"), "Skill detail") } }
    },
    "/api/v1/skills/runs": {
      get: { tags: ["operations"], summary: "List skill runs", responses: { "200": jsonResponse(ref("SkillRunsResponse"), "Skill runs") } }
    },
    "/api/v1/skills/{skill_id}/enable": {
      post: { tags: ["operations"], summary: "Enable skill", parameters: [pathParam("skill_id")], responses: { "200": jsonResponse(ref("GenericOkResponse"), "Skill enabled") } }
    },
    "/api/v1/skills/{skill_id}/disable": {
      post: { tags: ["operations"], summary: "Disable skill", parameters: [pathParam("skill_id")], responses: { "200": jsonResponse(ref("GenericOkResponse"), "Skill disabled") } }
    },
    "/api/v1/agronomy/rule-performance": {
      get: { tags: ["operations"], summary: "Read agronomy rule performance list", responses: { "200": jsonResponse(ref("RulePerformanceResponse"), "Rule performance list") } }
    },
    "/api/v1/agronomy/rule-performance/{rule_id}": {
      get: { tags: ["operations"], summary: "Read agronomy rule performance detail", parameters: [pathParam("rule_id")], responses: { "200": jsonResponse(ref("RulePerformanceResponse"), "Rule performance detail") } }
    },
    "/api/v1/agronomy/recommendations": {
      get: { tags: ["operations"], summary: "List agronomy recommendations", responses: { "200": jsonResponse(ref("RecommendationsListResponse"), "Recommendations list") } }
    },
    "/api/v1/agronomy/recommendations/{recommendation_id}": {
      get: { tags: ["operations"], summary: "Read agronomy recommendation", parameters: [pathParam("recommendation_id")], responses: { "200": jsonResponse(ref("RecommendationDetailResponse"), "Recommendation detail") } }
    },
    "/api/v1/agronomy/recommendations/control-plane": {
      get: { tags: ["operations"], summary: "Read agronomy recommendations control-plane projection", responses: { "200": jsonResponse(ref("RecommendationControlPlaneResponse"), "Recommendation control-plane projection") } }
    },
    "/api/v1/agronomy/recommendations/{recommendation_id}/control-plane": {
      get: { tags: ["operations"], summary: "Read agronomy recommendation control-plane projection", parameters: [pathParam("recommendation_id")], responses: { "200": jsonResponse(ref("RecommendationControlPlaneResponse"), "Recommendation control-plane detail") } }
    },
    "/api/v1/simulators/irrigation/execute": {
      post: { tags: ["operations"], summary: "Execute irrigation simulator", responses: { "200": jsonResponse(ref("GenericOkResponse"), "Simulator execution result") } }
    },
    "/api/v1/judge/health": {
      get: { tags: ["judge"], summary: "Judge V2 module health", responses: { "200": jsonResponse(ref("GenericOkResponse"), "Judge V2 health") } }
    },
    "/api/v1/judge/evidence/evaluate": {
      post: { tags: ["judge"], summary: "Evaluate evidence judge", responses: { "200": { description: "Judge result created" } } }
    },
    "/api/v1/judge/agronomy/evaluate": {
      post: { tags: ["judge"], summary: "Evaluate agronomy judge", responses: { "200": { description: "Judge result created" } } }
    },
    "/api/v1/judge/execution/evaluate": {
      post: { tags: ["judge"], summary: "Evaluate execution judge", responses: { "200": { description: "Judge result created" } } }
    },
    "/api/v1/judge/results/{judge_id}": {
      get: {
        tags: ["judge"],
        summary: "Read judge result by id",
        parameters: [
          pathParam("judge_id"),
          queryParam("tenant_id", { type: "string" }, true),
          queryParam("project_id", { type: "string" }, true),
          queryParam("group_id", { type: "string" }, true),
        ],
        responses: { "200": { description: "Judge result detail" } }
      }
    },
    "/api/v1/judge/results/by-kind/{judge_kind}": {
      get: {
        tags: ["judge"],
        summary: "List judge results by kind",
        parameters: [
          pathParam("judge_kind"),
          queryParam("tenant_id", { type: "string" }, true),
          queryParam("project_id", { type: "string" }, true),
          queryParam("group_id", { type: "string" }, true),
          queryParam("limit", { type: "integer" })
        ],
        responses: { "200": { description: "Judge result list" } }
      }
    },
    "/api/v1/judge/results/by-field/{field_id}": {
      get: {
        tags: ["judge"],
        summary: "List judge results by field",
        parameters: [
          pathParam("field_id"),
          queryParam("tenant_id", { type: "string" }, true),
          queryParam("project_id", { type: "string" }, true),
          queryParam("group_id", { type: "string" }, true),
          queryParam("limit", { type: "integer" })
        ],
        responses: { "200": { description: "Judge result list" } }
      }
    },
    "/api/v1/judge/results/by-task/{task_id}": {
      get: {
        tags: ["judge"],
        summary: "List judge results by task",
        parameters: [
          pathParam("task_id"),
          queryParam("tenant_id", { type: "string" }, true),
          queryParam("project_id", { type: "string" }, true),
          queryParam("group_id", { type: "string" }, true),
          queryParam("limit", { type: "integer" })
        ],
        responses: { "200": { description: "Judge result list" } }
      }
    },
    "/api/v1/judge/results/by-prescription/{prescription_id}": {
      get: {
        tags: ["judge"],
        summary: "List judge results by prescription",
        parameters: [
          pathParam("prescription_id"),
          queryParam("tenant_id", { type: "string" }, true),
          queryParam("project_id", { type: "string" }, true),
          queryParam("group_id", { type: "string" }, true),
          queryParam("limit", { type: "integer" })
        ],
        responses: { "200": { description: "Judge result list" } }
      }
    },
  });


  Object.assign(spec.paths, {
    "/api/v1/actions/task": { post: { tags: ["operations"], summary: "Create AO-ACT task", requestBody: { required: true, content: { "application/json": { schema: ref("ActionTaskRequest") } } }, responses: { "200": jsonResponse(ref("ActionTaskResponse"), "AO-ACT task accepted") } } },
    "/api/v1/actions/receipt": { post: { tags: ["operations"], summary: "Submit AO-ACT receipt", requestBody: { required: true, content: { "application/json": { schema: ref("ActionReceiptRequest") } } }, responses: { "200": jsonResponse(ref("ActionReceiptResponse"), "AO-ACT receipt accepted") } } },
    "/api/v1/actions/execute": { post: { tags: ["operations"], summary: "Execute action via control plane", requestBody: { required: true, content: { "application/json": { schema: ref("ActionExecuteRequest") } } }, responses: { "200": jsonResponse(ref("ActionExecuteResponse"), "Action execution accepted") } } },
    "/api/v1/operations/manual": { post: { tags: ["operations"], summary: "Create manual operation", requestBody: { required: true, content: { "application/json": { schema: ref("OperationManualRequest") } } }, responses: { "200": jsonResponse(ref("OperationManualResponse"), "Manual operation created") } } },
    "/api/v1/approvals/request": { post: { tags: ["operations"], summary: "Create approval request", requestBody: { required: true, content: { "application/json": { schema: ref("ApprovalRequestCreateBody") } } }, responses: { "200": jsonResponse(ref("ApprovalRequestCreateResponse"), "Approval request created") } } },
    "/api/v1/approvals/requests": { get: { tags: ["operations"], summary: "List approval requests", responses: { "200": jsonResponse(ref("ApprovalRequestListResponse"), "Approval request list") } } },
    "/api/v1/approvals/approve": { post: { tags: ["operations"], summary: "Approve or reject an approval request", requestBody: { required: false, content: { "application/json": { schema: ref("ApprovalApproveBody") } } }, responses: { "200": jsonResponse(ref("ApprovalApproveResponse"), "Approval decision recorded") } } },
    "/api/v1/recommendations/generate": { post: { tags: ["operations"], summary: "Generate agronomy recommendation", requestBody: { required: true, content: { "application/json": { schema: ref("RecommendationGenerateBody") } } }, responses: { "200": jsonResponse(ref("RecommendationGenerateResponse"), "Recommendation generation result") } } },
    "/api/v1/recommendations/{recommendation_id}/submit-approval": { post: { tags: ["operations"], summary: "Submit recommendation for approval", parameters: [pathParam("recommendation_id")], requestBody: { required: false, content: { "application/json": { schema: ref("RecommendationSubmitApprovalBody") } } }, responses: { "200": jsonResponse(ref("RecommendationSubmitApprovalResponse"), "Recommendation approval submitted") } } },
    "/api/v1/prescriptions/from-recommendation": { post: { tags: ["operations"], summary: "Create prescription from recommendation", requestBody: { required: true, content: { "application/json": { schema: ref("PrescriptionFromRecommendationRequest") } } }, responses: { "200": jsonResponse(ref("PrescriptionFromRecommendationResponse"), "Prescription created or reused") } } },
    "/api/v1/prescriptions/{prescription_id}": { get: { tags: ["operations"], summary: "Read prescription by id", parameters: [pathParam("prescription_id")], responses: { "200": jsonResponse(ref("PrescriptionReadResponse"), "Prescription detail") } } },
    "/api/v1/prescriptions/by-recommendation/{recommendation_id}": { get: { tags: ["operations"], summary: "Read prescription by recommendation id", parameters: [pathParam("recommendation_id")], responses: { "200": jsonResponse(ref("PrescriptionReadResponse"), "Prescription detail") } } },
    "/api/v1/prescriptions/{prescription_id}/submit-approval": { post: { tags: ["operations"], summary: "Submit prescription for approval", parameters: [pathParam("prescription_id")], requestBody: { required: false, content: { "application/json": { schema: ref("GenericTenantBody") } } }, responses: { "200": jsonResponse(ref("PrescriptionSubmitApprovalResponse"), "Prescription approval submitted") } } },

    "/api/v1/as-executed/health": { get: { tags: ["operations"], summary: "As-executed module health", responses: { "200": jsonResponse(ref("GenericOkResponse"), "As-executed module health") } } },
    "/api/v1/as-executed/from-receipt": { post: { tags: ["operations"], summary: "Create as-executed and as-applied from receipt", requestBody: { required: true, content: { "application/json": { schema: ref("AsExecutedFromReceiptRequest") } } }, responses: { "200": jsonResponse(ref("AsExecutedFromReceiptResponse"), "As-executed and as-applied created or reused") } } },
    "/api/v1/as-executed/{as_executed_id}": { get: { tags: ["operations"], summary: "Read as-executed by id", parameters: [pathParam("as_executed_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": { description: "As-executed detail" } } } },
    "/api/v1/as-executed/by-task/{task_id}": { get: { tags: ["operations"], summary: "List as-executed by task", parameters: [pathParam("task_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": { description: "As-executed list by task" } } } },
    "/api/v1/as-executed/by-receipt/{receipt_id}": { get: { tags: ["operations"], summary: "List as-executed by receipt", parameters: [pathParam("receipt_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": { description: "As-executed list by receipt" } } } },
    "/api/v1/as-executed/by-prescription/{prescription_id}": { get: { tags: ["operations"], summary: "List as-executed and as-applied by prescription", parameters: [pathParam("prescription_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": { description: "As-executed and as-applied list by prescription" } } } },

    "/api/v1/roi-ledger/health": { get: { tags: ["operations"], summary: "ROI ledger module health", responses: { "200": jsonResponse(ref("GenericOkResponse"), "ROI ledger module health") } } },
    "/api/v1/roi-ledger/from-as-executed": { post: { tags: ["operations"], summary: "Generate ROI ledger entries from as-executed", requestBody: { required: true, content: { "application/json": { schema: ref("RoiLedgerFromAsExecutedRequest") } } }, responses: { "200": jsonResponse(ref("RoiLedgerFromAsExecutedResponse"), "ROI ledger entries created or reused") } } },
    "/api/v1/roi-ledger/by-as-executed/{as_executed_id}": { get: { tags: ["operations"], summary: "List ROI ledger entries by as-executed", parameters: [pathParam("as_executed_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": jsonResponse(ref("RoiLedgerFromAsExecutedResponse"), "ROI ledger entries by as-executed") } } },
    "/api/v1/roi-ledger/by-task/{task_id}": { get: { tags: ["operations"], summary: "List ROI ledger entries by task", parameters: [pathParam("task_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": jsonResponse(ref("RoiLedgerFromAsExecutedResponse"), "ROI ledger entries by task") } } },
    "/api/v1/roi-ledger/by-prescription/{prescription_id}": { get: { tags: ["operations"], summary: "List ROI ledger entries by prescription", parameters: [pathParam("prescription_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": jsonResponse(ref("RoiLedgerFromAsExecutedResponse"), "ROI ledger entries by prescription") } } },
    "/api/v1/roi-ledger/by-field/{field_id}": { get: { tags: ["operations"], summary: "List ROI ledger entries by field", parameters: [pathParam("field_id"), queryParam("tenant_id", { type: "string" }, true), queryParam("project_id", { type: "string" }, true), queryParam("group_id", { type: "string" }, true)], responses: { "200": jsonResponse(ref("RoiLedgerFromAsExecutedResponse"), "ROI ledger entries by field") } } },
    "/api/v1/devices": { post: { tags: ["devices"], summary: "Register or upsert device", requestBody: { required: true, content: { "application/json": { schema: ref("DeviceUpsertRequest") } } }, responses: { "200": jsonResponse(ref("DeviceUpsertResponse"), "Device upsert result") } }, get: { tags: ["devices"], summary: "List devices", responses: { "200": jsonResponse(ref("DevicesListResponse"), "Devices list") } } },
    "/api/v1/devices/{device_id}": { get: { tags: ["devices"], summary: "Read device detail", parameters: [pathParam("device_id")], responses: { "200": jsonResponse(ref("DeviceDetailResponse"), "Device detail") } }, post: { tags: ["devices"], summary: "Update device metadata", parameters: [pathParam("device_id")], requestBody: { required: true, content: { "application/json": { schema: ref("DeviceUpsertRequest") } } }, responses: { "200": jsonResponse(ref("DeviceUpsertResponse"), "Device updated") } } },
    "/api/v1/devices/{device_id}/capabilities": { get: { tags: ["devices"], summary: "Read device capabilities", parameters: [pathParam("device_id")], responses: { "200": jsonResponse(ref("DeviceCapabilitiesResponse"), "Device capabilities") } }, put: { tags: ["devices"], summary: "Update device capabilities", parameters: [pathParam("device_id")], requestBody: { required: true, content: { "application/json": { schema: ref("DeviceCapabilitiesRequest") } } }, responses: { "200": jsonResponse(ref("DeviceCapabilitiesResponse"), "Device capabilities updated") } } },
    "/api/v1/devices/{device_id}/heartbeat": { post: { tags: ["telemetry"], summary: "Write a device heartbeat", parameters: [pathParam("device_id")], requestBody: { required: false, content: { "application/json": { schema: ref("HeartbeatRequest") } } }, responses: { "200": jsonResponse(ref("GenericOkResponse"), "Heartbeat accepted") } } },
    "/api/v1/devices/{device_id}/console": { get: { tags: ["devices"], summary: "Read device console view", parameters: [pathParam("device_id")], responses: { "200": jsonResponse(ref("DeviceConsoleResponse"), "Device console view") } } },
    "/api/v1/devices/{device_id}/control-plane": { get: { tags: ["devices"], summary: "Read device control-plane view", parameters: [pathParam("device_id")], responses: { "200": jsonResponse(ref("DeviceControlPlaneResponse"), "Device control-plane view") } } },
    "/api/v1/devices/onboarding/register": { post: { tags: ["devices"], summary: "Register device onboarding flow", requestBody: { required: true, content: { "application/json": { schema: ref("DeviceUpsertRequest") } } }, responses: { "200": jsonResponse(ref("DeviceUpsertResponse"), "Device onboarding registration result") } } },
    "/api/v1/devices/register": { post: { tags: ["devices"], summary: "Register device (compatibility v1 alias)", requestBody: { required: true, content: { "application/json": { schema: ref("DeviceUpsertRequest") } } }, responses: { "200": jsonResponse(ref("DeviceUpsertResponse"), "Device registration result") } } },
    "/api/v1/devices/{device_id}/credentials": { post: { tags: ["devices"], summary: "Issue device credential", parameters: [pathParam("device_id")], requestBody: { required: false, content: { "application/json": { schema: ref("DeviceCredentialIssueRequest") } } }, responses: { "200": jsonResponse(ref("DeviceCredentialIssueResponse"), "Device credential issued") } } },
    "/api/v1/devices/{device_id}/credentials/{credential_id}/revoke": { post: { tags: ["devices"], summary: "Revoke device credential", parameters: [pathParam("device_id"), pathParam("credential_id")], requestBody: { required: false, content: { "application/json": { schema: ref("DeviceCredentialRevokeRequest") } } }, responses: { "200": jsonResponse(ref("DeviceCredentialRevokeResponse"), "Device credential revoked") } } },
    "/api/v1/devices/{device_id}/skill-bindings/reconcile": { post: { tags: ["devices"], summary: "Reconcile device skill bindings", parameters: [pathParam("device_id")], requestBody: { required: false, content: { "application/json": { schema: ref("DeviceSkillBindingsReconcileRequest") } } }, responses: { "200": jsonResponse(ref("DeviceSkillBindingsReconcileResponse"), "Device skill bindings reconciled") } } },
    "/api/v1/devices/{device_id}/onboarding-status": { get: { tags: ["devices"], summary: "Read device onboarding status", parameters: [pathParam("device_id")], responses: { "200": jsonResponse(ref("DeviceOnboardingStatusResponse"), "Device onboarding status") } } },
    "/api/v1/sense/task": { post: { tags: ["operations"], summary: "Create sensing task", requestBody: { required: true, content: { "application/json": { schema: ref("SenseTaskRequest") } } }, responses: { "200": jsonResponse(ref("SenseTaskResponse"), "Sensing task created") } } },
    "/api/v1/sense/receipt": { post: { tags: ["operations"], summary: "Submit sensing receipt", requestBody: { required: true, content: { "application/json": { schema: ref("SenseReceiptRequest") } } }, responses: { "200": jsonResponse(ref("SenseReceiptResponse"), "Sensing receipt accepted") } } },
    "/api/v1/sense/tasks": { get: { tags: ["operations"], summary: "List sensing tasks", responses: { "200": jsonResponse(ref("SenseTasksResponse"), "Sensing tasks") } } },
    "/api/v1/sense/receipts": { get: { tags: ["operations"], summary: "List sensing receipts", responses: { "200": jsonResponse(ref("SenseReceiptsResponse"), "Sensing receipts") } } },
    "/api/v1/sense/next-task": { get: { tags: ["operations"], summary: "Read next sensing task", responses: { "200": jsonResponse(ref("SenseNextTaskResponse"), "Next sensing task") } } },
    "/api/v1/skills/bindings": { get: { tags: ["operations"], summary: "Read effective skill bindings", responses: { "200": jsonResponse(ref("SkillBindingsResponse"), "Skill bindings") } }, post: { tags: ["operations"], summary: "Create skill binding", requestBody: { required: true, content: { "application/json": { schema: ref("SkillBindingCreateRequest") } } }, responses: { "201": jsonResponse(ref("SkillBindingWriteResponse"), "Skill binding created") } } },
    "/api/v1/skills/bindings/override": { post: { tags: ["operations"], summary: "Append override-only skill binding", requestBody: { required: true, content: { "application/json": { schema: ref("SkillBindingOverrideRequest") } } }, responses: { "201": jsonResponse(ref("SkillBindingWriteResponse"), "Skill binding override appended") } } },
  });

  return spec;
}

export function registerOpenApiV1Routes(app: FastifyInstance) { // Register OpenAPI export route.
  app.get("/api/v1/openapi.json", async (_req, reply) => { // Serve OpenAPI JSON.
    return reply.send(buildOpenApiSpec()); // Return JSON object directly.
  }); // End route.
} // End register.
