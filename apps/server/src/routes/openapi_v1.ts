// GEOX/apps/server/src/routes/openapi_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance type.

function buildOpenApiSpec() { // Build a minimal Commercial v1 OpenAPI document.
  return {
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
        DeviceCredentialIssueResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            tenant_id: { type: "string" },
            device_id: { type: "string" },
            credential_id: { type: "string" },
            credential_secret: {
              type: "string",
              description: "One-time secret returned only at issuance time."
            },
            credential_hash: { type: "string" }
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
          required: ["alert_id", "status", "severity", "title", "triggered_at_ts_ms"],
          properties: {
            alert_id: { type: "string" },
            status: { type: "string", enum: ["OPEN", "ACKED", "CLOSED"] },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            title: { type: "string" },
            message: { type: "string" },
            rule_id: { type: "string" },
            field_id: { type: "string" },
            device_id: { type: "string" },
            triggered_at_ts_ms: { type: "integer", format: "int64" },
            acked_at_ts_ms: { type: "integer", format: "int64", nullable: true },
            resolved_at_ts_ms: { type: "integer", format: "int64", nullable: true }
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
          required: ["ok", "total", "open", "acked", "closed"],
          properties: {
            ok: { type: "boolean" },
            total: { type: "integer" },
            open: { type: "integer" },
            acked: { type: "integer" },
            closed: { type: "integer" }
          }
        },
        AlertActionRequest: {
          type: "object",
          properties: {
            note: { type: "string", description: "Optional operator note for ack/resolve action." }
          }
        },
        AlertActionResponse: {
          type: "object",
          required: ["ok", "alert_id", "status"],
          properties: {
            ok: { type: "boolean" },
            alert_id: { type: "string" },
            status: { type: "string", enum: ["OPEN", "ACKED", "CLOSED"] },
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
          required: ["type", "version", "generated_at", "identifiers", "execution", "acceptance", "evidence", "cost", "sla", "risk"],
          properties: {
            type: { type: "string", enum: ["operation_report_v1"] },
            version: { type: "string", enum: ["v1"] },
            generated_at: { type: "string", format: "date-time" },
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
              required: ["fields", "recent_operations", "risk_summary", "period_summary"],
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
                recent_operations: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["operation_id", "operation_plan_id", "field_id", "executed_at", "risk_level", "risk_reasons", "estimated_total_cost", "execution_duration_ms"],
                    properties: {
                      operation_id: { type: "string" },
                      operation_plan_id: { type: "string" },
                      field_id: { type: "string" },
                      executed_at: { type: "string", format: "date-time", nullable: true },
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
                  required: ["total_operations", "total_cost", "avg_sla_ms"],
                  properties: {
                    total_operations: { type: "integer" },
                    total_cost: { type: "number" },
                    avg_sla_ms: { type: "number", nullable: true }
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
      "/api/devices": {
        post: {
          tags: ["devices"],
          summary: "Register a device",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/DeviceRegistrationRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Device registered successfully" }
          }
        }
      },
      "/api/devices/{device_id}/credentials": {
        post: {
          tags: ["devices"],
          summary: "Issue a device credential",
          parameters: [
            { name: "device_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Credential issued successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceCredentialIssueResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/devices/{device_id}/credentials": {
        post: {
          tags: ["devices"],
          summary: "Issue a device credential via v1 alias",
          parameters: [
            { name: "device_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": {
              description: "Credential issued successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/DeviceCredentialIssueResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/devices/{device_id}/heartbeat": {
        post: {
          tags: ["telemetry"],
          summary: "Write a device heartbeat",
          parameters: [
            { name: "device_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/HeartbeatRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Heartbeat accepted" }
          }
        }
      },
      "/api/v1/devices": {
        get: {
          tags: ["devices"],
          summary: "Read device list",
          responses: {
            "200": { description: "Device list returned successfully" }
          }
        }
      },
      "/api/v1/devices/{device_id}": {
        get: {
          tags: ["devices"],
          summary: "Read device detail",
          parameters: [
            { name: "device_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Device detail returned successfully" }
          }
        }
      },
      "/api/v1/devices/{device_id}/console": {
        get: {
          tags: ["devices"],
          summary: "Read device integration and execution console",
          parameters: [
            { name: "device_id", in: "path", required: true, schema: { type: "string" } }
          ],
          responses: {
            "200": { description: "Device console returned successfully" }
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
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertActionRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert acknowledged successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertActionResponse" }
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
          parameters: [
            { name: "alert_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { '$ref': "#/components/schemas/AlertActionRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Alert resolved successfully",
              content: {
                "application/json": {
                  schema: { '$ref': "#/components/schemas/AlertActionResponse" }
                }
              }
            }
          }
        }
      },
      "/api/v1/alerts/notifications": {
        get: {
          tags: ["alerts"],
          summary: "Read alert notification records",
          responses: {
            "200": { description: "Alert notification records returned successfully" }
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
      "/api/v1/operations/console": {
        get: {
          tags: ["operations"],
          summary: "Read operations workbench aggregate",
          responses: {
            "200": { description: "Operations workbench returned successfully" }
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
      "/api/v1/approval-requests": {
        post: {
          tags: ["operations"],
          summary: "Create approval request",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" }
              }
            }
          },
          responses: {
            "200": { description: "Approval request created successfully" }
          }
        },
        get: {
          tags: ["operations"],
          summary: "Read approval request list",
          responses: {
            "200": { description: "Approval request list returned successfully" }
          }
        }
      },
      "/api/v1/approval-requests/{request_id}/approve": {
        post: {
          tags: ["operations"],
          summary: "Approve or reject an approval request",
          parameters: [
            { name: "request_id", in: "path", required: true, schema: { type: "string" } }
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { type: "object" }
              }
            }
          },
          responses: {
            "200": { description: "Approval request decision recorded successfully" }
          }
        }
      },
      "/api/v1/control/approval-requests": {
        post: {
          tags: ["operations"],
          summary: "Create an approval request via legacy control path",
          responses: {
            "200": { description: "Approval request created successfully" }
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
  }; // Return the OpenAPI object.
} // End helper.

export function registerOpenApiV1Routes(app: FastifyInstance) { // Register OpenAPI export route.
  app.get("/api/v1/openapi.json", async (_req, reply) => { // Serve OpenAPI JSON.
    return reply.send(buildOpenApiSpec()); // Return JSON object directly.
  }); // End route.
} // End register.
