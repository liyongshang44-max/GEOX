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
          responses: {
            "200": { description: "Alert event list returned successfully" }
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
