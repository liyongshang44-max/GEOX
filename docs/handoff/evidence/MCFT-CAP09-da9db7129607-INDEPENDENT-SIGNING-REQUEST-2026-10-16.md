# MCFT CAP-09 — Independent signing handoff (2026-10-16)

Status: SIGNING REQUEST ONLY. No private key, signature, authority transfer, permit, or execution authorization is present. TEST_ONLY HOLD; Production HOLD.

## Fixed qualification inputs (Windows operator evidence)

- Run ID: `da9db7129607`.
- Frozen/adoption subject: `91835fa0997730c85c5f3869dd530f4c9a3ca82d`.
- Local infrastructure V2 manifest: `D:\gptdown\MCFT-CAP09-da9db7129607-INFRA-AUDIT-V1\infrastructure-qualification-v2.json`; file SHA-256: `AF4DCAFE52FCA08D12DC913F369D97EA64DBFFF7B159FA702FDD57C13777899E`. Source V1 remains preserved. This SHA is not independent immutable sealing.
- Adoption candidate SHA-256: `263BFD2950823109E41D14B37FA3ED932606CE343FCA458F5E2735951B9FAD4A`.
- QCP proof SHA-256: `C2098F5587794A9FC033E994E77795AD872C1DEB6A1B44E108F359FF7D6F2D1E`.
- Merge derivation SHA-256: `C07DD68C0964E726AC7F3DF792938AAA66D3D5948D8B914715AC36B90AE5958A`.
- Release material binding SHA-256: `CCBDC69A050C4DD872819BE0BAF33FCD9576E3F363154DAB21046BDEF4A61FCC` (6428 source files).
- Installed material profile JSON file SHA-256: `6F92ACC06EE95F0254C68D415B658E4AB2061BE8B3C0E60B2E0EFAAE221C0839` (20890 files), canonical profile digest: `574c96e62f887ba3c7dc86b7f96476af21c017121c2a5084fb79add30609aa3b`.
- Official merge derivation validator operator result: PASS, auditor SHA-256 `F19DF78E918529F6B3738EC19D2CB388C5A99561C0D4945CC0A0A5DE508550B4`.
- Official release binding and installed material verification operator result: PASS, auditor SHA-256 `C865B44371CF708443C7600468450B30B29DC832D737FECD673F599E0891736F`.
- Direct signed cross-bucket PutObject denial receipt SHA-256: `D3CFC66555FE8CCB0F37B1425A2409169FFB6D9B1CFF6BA4977847E25EDB216A`; auditor SHA-256: `F306BFCC0BC446CA641B6C428BE9B7D42C0B56DA2564FD47C7A07E9AD6B2CAF0`.

## Registered independent Adoption issuer (read from main offline-trust.json)

- issuer_id `mcft_cap09_independent_adoption_governance`; key_id `cap09_adoption_ed25519_20261015`.
- Ed25519 SPKI SHA-256 `80e7897b28faf31da8973badad04a9d2e9b69f3f4cc82683dc67f0b4f3f48479`.
- Registry key lifetime `2026-10-15T00:00:00Z` through `2026-11-12T23:00:00Z`; policy valid until `2026-11-13T00:00:00Z`. Registry listing and role separation do not establish independent private-key custody.

## Required independent deliverables and checks

1. **Custody attestation:** name the accountable independent signing principal, their authorization, key custody boundary, and independently verifiable authorization/approval. Do not copy or reveal the private key to the local host operator. A self-attestation by the operator does not establish independence.
2. **Evidence seal:** independently obtain/review original local V2 and referenced evidence bytes; verify SHA-256, then return a timestamped signed or externally controlled tamper-evident archival receipt covering run, subject, manifest hash, evidence scope, issuer identity, key identity, signing algorithm, signature, and independent verification instructions. Local hashing and an unsigned Git commit are not substitutes.
3. **Formal Adoption:** independently review the full existing 91835fa0 candidate, original QCP source material/merge provenance, 54 checks, 108 frozen paths, installed material and exact release binding. Run the repository's Windows offline `formal-adoption` signer under actual independent custody with the registered key, with a fresh bounded lifetime, and return the produced signed envelope. Do not substitute a synthetic signer, stale signature, operator key, or infrastructure seal.
4. **Independent verification on target host:** verify registered signer fingerprint, canonical signature domain, exact candidate subject and hashes, material/environment, policy, host/operator, issuance/expiry and frozen execution boundary through the official offline verifier. Mark PASS only with a full verifier receipt. No execution is authorized by this request.
5. **Separate TEST_ONLY admission after Adoption PASS:** independently issue and validate run-scoped one-time Retry Permit, ARM, exact resource and six-stage plan binding, replay protection, child stage tickets, freshness, and execution-window constraints. This step is not performed by signing the evidence seal or Adoption envelope. Production stays HOLD.

## Fail-closed disposition

No signature has yet been supplied, no custody check is complete and no new Adoption has been verified. TEST_ONLY HOLD; Production HOLD. Preserve previous run receipts and original infrastructure qualification V1. Do not reinitialize resources, rerun denied PUT, alter immutable Runtime, rewrite historical QCP, or issue/consume a permit to paper over absent independent authority.
