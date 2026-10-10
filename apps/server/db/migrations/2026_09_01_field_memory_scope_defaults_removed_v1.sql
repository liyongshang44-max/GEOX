-- B-Line Formal Field Memory authority convergence.
-- Scope provenance must be explicit; database defaults must not manufacture tenant sub-scope.
ALTER TABLE field_memory_v1
  ALTER COLUMN project_id DROP DEFAULT,
  ALTER COLUMN group_id DROP DEFAULT;
