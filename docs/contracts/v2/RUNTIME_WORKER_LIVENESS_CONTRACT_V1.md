# RUNTIME WORKER LIVENESS CONTRACT V1

## 1. Position

Runtime worker liveness is proven by a DB-backed heartbeat contract, not by Docker log windows.

The source of truth is:

```text
worker_runtime_heartbeat_v1
```

Docker logs are diagnostic material only. They must not be used as the pass condition for worker liveness.

## 2. Required workers

Controlled Pilot requires these worker identities:

```text
jobs      geox-v1-jobs
executor  geox-v1-executor
```

`worker_id` must be stable in commercial compose. Use `GEOX_WORKER_ID` first, and fallback to hostname only for non-compose local development.

## 3. Heartbeat table contract

```sql
CREATE TABLE IF NOT EXISTS worker_runtime_heartbeat_v1 (
  worker_type TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  runtime_instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL,
  heartbeat_count BIGINT NOT NULL DEFAULT 0,
  last_tick_status TEXT,
  last_error TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_type, worker_id)
);
```

Indexes:

```text
idx_worker_runtime_heartbeat_v1_last_heartbeat_at
idx_worker_runtime_heartbeat_v1_worker_type
```

## 4. Worker semantics

`worker_type`:

```text
jobs
executor
```

`status`:

```text
STARTED
RUNNING
OK
ERROR
STOPPING
```

`last_tick_status`:

```text
OK
ERROR
IDLE
CLAIMED_TASK
NO_TASK
AGENT_SCANNED
```

`runtime_instance_id` changes on every process start. It distinguishes current process liveness from stale rows left by previous process instances.

`heartbeat_count` must be greater than zero.

`last_error` must be a short diagnostic summary, not an unbounded stack trace.

`metadata_json` should include runtime configuration context such as:

```text
interval_ms
poll_interval_ms
runtime_env
system_profile
container_hint
build_mode
```

## 5. Required behavior

Jobs runtime must write:

```text
STARTED when the process starts
RUNNING at tick start
OK after a successful tick
ERROR after a failed tick
```

Executor runtime must write:

```text
STARTED when the process starts
RUNNING at loop start
OK after a successful loop
ERROR after a failed loop
```

Heartbeat writes must be independent of MQTT and independent of device communication. This contract proves runtime process liveness only.

## 6. Acceptance rule

`ci:runtime:workers` must connect to the DB through `DATABASE_URL` and query `worker_runtime_heartbeat_v1` directly.

For each required worker:

```text
row must exist
runtime_instance_id must be non-empty
heartbeat_count must be > 0
status must not be ERROR or STOPPING
last_heartbeat_at must be fresh
```

Default freshness threshold:

```text
RUNTIME_WORKER_HEARTBEAT_MAX_AGE_MS=120000
```

Missing `DATABASE_URL` is a hard failure:

```text
RUNTIME_WORKERS_DATABASE_URL_REQUIRED
```

Missing heartbeat is a hard failure:

```text
RUNTIME_WORKER_HEARTBEAT_MISSING
```

Stale heartbeat is a hard failure:

```text
RUNTIME_WORKER_HEARTBEAT_STALE
```

Error status is a hard failure:

```text
RUNTIME_WORKER_HEARTBEAT_ERROR
```

## 7. Non-goals

This contract does not prove:

```text
business task success
MQTT device connectivity
AO-ACT dispatch correctness
agronomy recommendation quality
customer report correctness
```

Worker up is not equal to worker healthy. Worker healthy requires a fresh DB heartbeat.
