-- GEOX · ProblemState Lifecycle Governance Index (v1)
-- This table is NOT part of the Ledger (facts). It is a derived governance index.

create table if not exists problem_state_index_v1 (
  problem_state_id text primary key,
  lifecycle_state  text not null,
  as_of_ts_ms      bigint not null,
  computed_at      timestamptz not null default now(),
  superseded_by    text null,
  index_version    text not null default 'v1',
  constraint problem_state_index_v1_lifecycle_ck
    check (lifecycle_state in ('ACTIVE','SUPERSEDED','EXPIRED','FROZEN')),
  constraint problem_state_index_v1_version_ck
    check (index_version = 'v1')
);

create index if not exists idx_problem_state_index_v1_superseded_by
  on problem_state_index_v1 (superseded_by);
