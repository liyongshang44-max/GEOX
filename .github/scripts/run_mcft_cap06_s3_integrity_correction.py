# .github/scripts/run_mcft_cap06_s3_integrity_correction.py
# Purpose: execute the reviewed Python materialization block and normalize the two concurrency checks onto one canonical Candidate.
# Boundary: helper-PR tooling only; never copied into the correction branch or main.

from __future__ import annotations

from pathlib import Path

WORKFLOW = Path(".github/workflows/mcft-cap-06-s3-candidate-integrity-correction.yml")
START_LINE = "python - <<'PY'"
END_LINE = "PY"
YAML_BLOCK_INDENT = "          "

lines = WORKFLOW.read_text(encoding="utf-8").splitlines()
starts = [index for index, line in enumerate(lines) if line.strip() == START_LINE]
if len(starts) != 1:
    raise RuntimeError(f"S3_CORRECTION_START_BOUNDARY_INVALID:{len(starts)}")
start = starts[0]
ends = [
    index
    for index, line in enumerate(lines[start + 1 :], start=start + 1)
    if line.strip() == END_LINE
]
if len(ends) != 1:
    raise RuntimeError(f"S3_CORRECTION_END_BOUNDARY_INVALID:{len(ends)}")

raw = lines[start + 1 : ends[0]]
source = "\n".join(
    line[len(YAML_BLOCK_INDENT) :] if line.startswith(YAML_BLOCK_INDENT) else line
    for line in raw
) + "\n"
if not source.startswith("import json\n"):
    raise RuntimeError(f"S3_CORRECTION_SOURCE_START_INVALID:{source[:80]!r}")
for token in [
    "verifyEvaluationCandidateWithClientV1",
    "CAP06_EVALUATION_CANDIDATE_NOT_CANONICAL",
    "concurrent same-key different-hash Candidate",
]:
    if token not in source:
        raise RuntimeError(f"S3_CORRECTION_SOURCE_TOKEN_MISSING:{token}")

exec(compile(source, str(WORKFLOW), "exec"), {"__name__": "__main__"})

# The original acceptance already had one fresh concurrent Candidate. Reuse that same identity for
# both different-hash conflict and subsequent same-hash retries so canonical counts remain unchanged.
acceptance_path = Path("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts")
acceptance = acceptance_path.read_text(encoding="utf-8")
start_token = "  const concurrentConflictCandidate = candidateVariantV1(\n"
end_token = '  ok("concurrent same-key same-hash Candidate calls serialize to one canonical append");\n'
start_count = acceptance.count(start_token)
end_count = acceptance.count(end_token)
if start_count != 1 or end_count != 1:
    raise RuntimeError(f"S3_CONCURRENCY_NORMALIZATION_BOUNDARY_INVALID:{start_count}:{end_count}")
start_index = acceptance.index(start_token)
end_index = acceptance.index(end_token, start_index) + len(end_token)
replacement = '''  const concurrentCandidate = concurrentCandidateV1(fixture.candidate);
  const concurrentConflictVariant = structuredClone(concurrentCandidate);
  concurrentConflictVariant.payload.candidate_parameter_value = "0.035000";
  concurrentConflictVariant.payload.parameter_delta = "0.005000";
  concurrentConflictVariant.determinism_hash = "";
  concurrentConflictVariant.determinism_hash = semanticHashV1(concurrentConflictVariant);
  const concurrentConflictResults = await Promise.allSettled([
    repository.commitCanonicalObject({ object: concurrentCandidate }),
    repository.commitCanonicalObject({ object: concurrentConflictVariant }),
  ]);
  const concurrentConflictFulfilled = concurrentConflictResults.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.commitCanonicalObject>>> =>
      result.status === "fulfilled",
  );
  const concurrentConflictRejected = concurrentConflictResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.equal(concurrentConflictFulfilled.length, 1);
  assert.equal(concurrentConflictRejected.length, 1);
  assert.match(String(concurrentConflictRejected[0].reason), /CAP06_IDEMPOTENCY_CONFLICT/);
  const concurrentWinner = concurrentConflictFulfilled[0].value.object;
  assert.equal(
    await countV1(
      "facts WHERE record_json->'payload'->>'object_id'=$1",
      [concurrentWinner.object_id],
    ),
    1,
  );
  ok("concurrent same-key different-hash Candidate calls produce one winner and one deterministic conflict");

  const concurrentResults = await Promise.all(
    Array.from({ length: 8 }, () => repository.commitCanonicalObject({ object: concurrentWinner })),
  );
  assert.equal(
    concurrentResults.every((result) => result.status === "EXISTING_IDEMPOTENT_SUCCESS"),
    true,
  );
  assert.equal(
    concurrentResults.every((result) => result.object.determinism_hash === concurrentWinner.determinism_hash),
    true,
  );
  assert.equal(
    await countV1(
      "facts WHERE record_json->'payload'->>'object_id'=$1",
      [concurrentWinner.object_id],
    ),
    1,
  );
  ok("concurrent same-key same-hash Candidate retries converge on one canonical append");
'''
acceptance = acceptance[:start_index] + replacement + acceptance[end_index:]
acceptance_path.write_text(acceptance, encoding="utf-8")
