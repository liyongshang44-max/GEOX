# DA9 Retry / Admission V2

Candidate successor to `da9-retry-bundle.cjs`. V1 remains byte-identical and
continues to explain subject 91835fa0. V2 fixes only run da9db7129607; it contains
no future subject constant. Existing resources, six stages and Bridge empty
bucket contract are unchanged.

The actual offline verifier first validates the signed Adoption, its raw release
binding hash, release source inventory and installed material. Its private
verified context exposes the release's `source_tree_git_sha` as
`subject_tree_digest` (Git SHA-1 tree object ID), SHA-256 source inventory digest,
installed material digest and scoped Evidence identity source digest. V2 obtains
its subject exclusively from this context. The V2 entry itself must occur in the
signed release and match the currently executing bytes.

The V2 adjudication signs these bindings under a distinct V2 signature domain,
with the existing six historical evidence digests, attempt 2, unknown first
Provider count/phase and explicit prior-denial supersession. The real Host
requires and rechecks this adjudication on DA9 successor subjects before bundle
admission, parent permit consumption or child stage dispatch. Old signature
bytes cannot become a V2 decision by editing JSON.

Run V2 from the newly qualified installed successor release itself. It refuses
an external runtime root; it cannot overlay the immutable 91835fa0 release.
No module-cache patch, preload, frozen file replacement or transfer of a copied
verified context is supported. Reuse existing scientific semantics and resources,
but bind the successor's actual installed bytes and actual Host.

CLI (absolute paths; outside-release evidence and key files):

- `node scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs draft DECISION_ID ADOPTION OUTPUT`
- `node scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs review-sign REVIEW PRIVATE_KEY ISSUER KEY_ID OUTPUT ADOPTION`
- `node scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs sign INPUT ADOPTION RELEASE_ROOT PRIVATE_KEY ISSUER KEY_ID OUTPUT`

Draft never approves a review. Review signing does not issue a Permit. Bundle
signing does not consume it or run Producer. All existing fresh readback, budget,
expiry, nonce, ledger and official Preflight requirements remain mandatory.

Before signing: qualify the single final PR head, adopt the merge commit, then
build and verify that exact subject's release and installed material. Issue new
Adoption and Retry signatures; never rewrite or migrate old signatures.

## Remaining host evidence

MinIO is still HOLD until a reviewed DA9_MINIO_EVIDENCE_DISPOSITION_V1 binds the
complete original inventory, exact object/version identifiers, contents and WORM
copy hashes. Existing verified local WORM custody may be used; AWS custody is
not a new prerequisite. Only approved exact versions may subsequently be removed.
Official inventory must then report zero current objects, versions, delete
markers and multipart uploads. This PR performs no inventory, deletion, database
operation or real execution, and is not the disposition approval.
