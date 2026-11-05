# R4285 Prepare→Live V3

Authority: [CTO #6647496120](https://github.com/liyongshang44-max/GEOX/pull/3757#issuecomment-6647496120). One bounded nonlive successor implementation. Engineering deadline: **2026-11-06T10:00:00Z**. The prior recovery path remains BLOCKED; its deadline is not extended.

## Three separate outcomes

1. ENGINEERING: implementation, integrated nonlive contracts and exact source QCP/Release contract qualification. A source check is not an attestation that a new signed installed Windows release already exists.
2. RESOURCE AUTHORITY: current legitimately approved PG/S3 accounts, policy, expiry and credential source. Currently UNBOUND. This external input does not authorize further engineering scope expansion.
3. LIVE PREFLIGHT: a separately permitted one-time Windows session. Currently NOT_GRANTED / NOT_RUN. No production authority, Permit consumption or stage execution is implemented in the V3 entrypoint.

## Session-stable identity and signed domains

`MCFT_CAP09_R4285_SCOPE_V3.cjs` defines exact fields. Scope is stable **within one session across observation refreshes**, not across sessions: nonce is part of its signed identity. The stable identity is SHA-256 of `GEOX_MCFT_CAP09_R4285_SESSION_RESOURCE_SCOPE_V3\n` followed by canonical Scope payload bytes. It contains no Control/Inventory hash or observation timestamp. Replacing a resource, source, nonce or authorized lifetime creates a different Scope. Scope creation/signing is external; the implementation only verifies.

Scope binds current Subject / Run / Host / nonce, exact positive and negative PG roles and databases, owner/catalog identity, approved PG permission digest, actual account expiries, MinIO deployment, bucket/prefixes, account and Parent digests, resource policy identity, registered source signer, independently approved source policy bytes and delivery source ID. PostgreSQL `rolvaliduntil=null` is represented as actual no-expiry metadata, never as a fabricated finite timestamp; the signed Scope and credential delivery still expire. Unknown metadata is rejected. MinIO metadata aliases are bounded; unsupported native metadata is UNRESOLVED/HOLD rather than inferred from history.

| Consumer | Schema/domain version | Additional binding |
|---|---|---|
| Stable resource Scope | SESSION_RESOURCE_SCOPE_V3 | Session identity, real resources, source/lifetimes |
| Separate Control / Inventory signatures | SOURCE_OBSERVATION_V3 | Scope, nonce, original raw hash and original observed_at |
| Owner and readback | RESOURCE_OWNER_V3 / RESOURCE_READBACK_V3 | Scope, nonce, both signed observation digests, native source approval digest |
| Permit | SIGNED_ISOLATED_TEST_PERMIT_V3 | QCP73, Scope, source approval, observation digests and all original lineage/plan/material bindings |
| Final | FINAL_EXECUTION_APPROVAL_V3 | Same Scope and observations, exact Owner/Permit/readback and native Intent |
| Native / Adoption | Native Consumer V3 / Adoption V5 | Actual QCP73 source artifact and exact merged Subject / installed Release |
| Secret delivery | CREDENTIAL_DELIVERY_V3 | Approved source key, session Scope/nonce, exact roles/account and finite source delivery lifetime |

Every domain ends in a newline. The exact constants and payload field arrays in the corresponding consumers are normative. V3 signed wire files use sorted-key canonical UTF-8 JSON without BOM, whitespace or trailing newline. Duplicate fields and noncanonical encodings are rejected. Historical input files retain original bytes and their original consumers; old V1/V2 signatures are never reinterpreted as V3.

## Trusted preparation and loading

The factory `MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs` owns the private WeakMap/WeakSet capabilities. Its production API has no injectable verifier, Host callback, fixture authority, `authority=PASS` field or serialized certificate shortcut. Native Consumer V3 is an explicit versioned successor of the original Native factory logic and preserves genuine process-native provenance; Admission V3 likewise preserves native GitHub Intent and stable capability creation. Historical V2 files are unchanged.

Before reading FD3, preparation verifies current source qualification, registered repository trust, signed Adoption V5, exact installed Material/Release/tool identity, the independently approved resource Scope/source policy, explicit launch permission and native CTO Intent. Actual `pg`, S3 SDK and `tsx` imports then occur through native Node modules/resolver objects and a pinned original-source loading boundary. There are no diagnostic FS/network proxies in those module objects. An actually reached addon, unsupported module format, path outside the release or source drift fails at that route; unused optional packages are not standalone gates.

Pinned loading requires the synchronous `node:module.registerHooks` capability available on the current Node 24 runtime. It snapshots registered JS/CJS/MJS/JSON bytes after full Native verification, checks already loaded release modules, and retains native exports/cache/require/import behavior. Full dynamic Material/tools revalidation still runs later; pinned loading does not replace it.

Resource secrets are delivered only on the one-shot FD3 stream, signed by the approved registered source key. They are merged into an explicit private Host environment, never assigned to `process.env` or published. Frame buffers are cleared and references are removed at failure, revocation or session end. JavaScript string memory cannot be reliably zeroized; the claim is bounded reference lifetime, not guaranteed RAM erasure. No secret is supplied to the tests.

## One live receiver, still non-consuming

Only supported Host command:

```powershell
& $QualifiedNode $InstalledHostV3 --session-preflight-only --input $CanonicalV3Input
```

This is an interface declaration, **not permission to run it now**. `$QualifiedNode` must be the actual installed runtime bound by the new release, not the Volta launcher. There is no `--execute`, direct `--preflight-only`, automatic retry, signer, account provisioner or Permit-consumption entrypoint.

The exact input key list is exported as `PrepareLiveV3.INPUTS`; it includes the original Host paths plus Scope, independently approved source policy/approval, launch authorization, CTO Intent, nonce and a revocation path. All file paths are absolute and distinct. The source root is a clean current protected-main checkout; the executable consumers must come from the signed installed release. Supplying JSON inspection output as capability fails.

Preparation and transition both require these four files to be absent: resource readback, signed Owner, Permit and Final. The factory consumes its private capability synchronously before any await, writes a separate exclusive **preflight attempt** record under the already registered ledger root and then opens WAIT. That record is not a Permit consumption and does not touch historical A/B records; it must not be deleted to retry. It prevents a second process from reusing the same session Scope as another one-time launch. The Host does not create the independent Producer/signature files.

After WAIT, the independent Producer obtains fresh original Control/Inventory, verifies their separate signatures and original native clocks, performs the real read-only PG/S3 checks and publishes one V3 readback. Original MinIO/Docker raw bytes remain protected; public receipts contain only signed observation envelopes and digests, never base64 `Config.Env` or credentials. The external Owner/Permit/Final signers publish the other files independently. The existing requirement that Final exists before dynamic validation remains.

The Host repeats real PG/S3 checks, verifies current account permissions/expiry against Scope, fully rehashes Material/tools, refreshes resource/launch authorization and finally refetches CTO Intent. It requires Owner and both source observations to remain within 120 seconds, the final CTO refetch within 15 seconds at actual acceptance, and remaining Permit time **strictly greater than 10,800,000 + 60,000 ms**, bounded by Adoption/Owner/Scope lifetimes. Source/launch rechecks precede the final CTO refetch so they do not consume the final 15-second interval unnecessarily. Future published files are pinned against replacement. Revocation, expiry or drift fails closed, without consuming a Permit.

## Independent native authorizations

Two existing categories of external evidence remain necessary, not new engineering approval tasks:

- Resource source approval uses the exact `SOURCE_AUTHORITY_APPROVAL_V3` native OWNER comment shape exported by Scope V3, binding the Scope envelope digest, original source policy digest, source key fingerprint and delivery origin. The old key-purpose comment cannot satisfy it. This is the already acknowledged RESOURCE AUTHORITY external input; no claim that it has been issued is made.
- A real session uses the exact `SESSION_LAUNCH_V3` native OWNER decision `AUTHORIZE_ONE_V3_SESSION_PREFLIGHT_ONLY`, scoped to current Subject/Host/Run/nonce/Scope and validity. The architecture authorization cannot satisfy it. No launch comment is posted by this implementation.

The independent Producer V3 CLI accepts `--produce-raw --input <producer-input> --sources <canonical-source-spec> --output <new-file>`. It checks Native V3 before FD3 delivery and keeps native command child environments scrubbed. Its source spec names protected CurrentUser source capsules, signed Control/Inventory, Scope, source policy/approval, original WAIT lower bound, Native input and launch authorization. Neither Host nor Producer contains a private-key signing operation.

## Source qualification and Release reporting

QCP73 adds one exact path resolver/check for this entire successor unit. Prior 72 check definitions/resolvers remain object-identical and are reported NOT_APPLICABLE, not as 72 newly executed PASS results. The source gate checks the exact authorized base and diff, preserved historical sources, native CI event/head/repository, original CTO authority and integrated contracts. Unknown paths remain errors.

Native V3 requires the real QCP73 raw artifact/ZIP/GitHub run provenance, correct exact merge and current main, CI result, Adoption V5 and installed Material/Release binding. The existing Frozen V13 workflow runs its unchanged historical assertion on the pinned original source for this exact successor PR; current V3 source is owned by QCP73. This is applicability separation, not a changed historical digest. Central V3 contract execution explicitly uses Node 24.19.0.

Source CI alone never produces or signs that installed release. Report missing new Release/Adoption evidence as an engineering/release-qualification blocker, separately from RESOURCE AUTHORITY and LIVE PREFLIGHT. No merge or Release signature is automatically authorized here.

Integrated tests exercise isolated Ed25519 domain/signature negatives, stable session Scope, source authority provenance, expiry/drift/revocation/concurrency and once-only transition, actual native CJS/ESM pinned module semantics and changed-source rejection. External authority and I/O doubles used in lifecycle tests are local to test module loading and cannot mint production Native proofs. Such tests are source engineering evidence, not Windows B→C evidence.
