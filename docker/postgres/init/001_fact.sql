create table if not exists facts (
  fact_id     text primary key,
  occurred_at timestamptz not null,
  source      text not null,
  record_json text not null,
  ingested_at timestamptz not null default now()
);

create or replace function facts_append_only_guard()
returns trigger as $$
begin
  raise exception 'facts is append-only: UPDATE/DELETE forbidden';
end;
$$ language plpgsql;

drop trigger if exists facts_no_update on facts;
create trigger facts_no_update
before update on facts
for each row execute function facts_append_only_guard();

drop trigger if exists facts_no_delete on facts;
create trigger facts_no_delete
before delete on facts
for each row execute function facts_append_only_guard();