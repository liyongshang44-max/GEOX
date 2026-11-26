# P6-B2/C3 bounded native consumer candidate

Base GEOX 4f9c5b19de151eab49bcc90cf8aed23d7db62dcc; FDW #6 2e2c8ce9c363d13675261cc525f0986c188791eb; ADR d63c3058d6b95873e811445920f7302ded980ef3.

Existing Product composition accepts explicit trusted manager identity and directory dependencies, forwarding to existing P1/P2 routes. Default bootstrap passes no provider. No legacy route permission change. FDW formal port is structurally compatible; actual Keycloak token format/revocation, authoritative land directory, creation-to-grant workflow and legacy bypass audit remain open.

ADR consumer implements five fixed native P02 HTTP operations using server-side exact request/scope binding and server-held credential. REQUEST_CROP_REVIEW is an independent candidate action, not implied by an existing grant. The resolver must provide actual approved ADR principal, target/program and AuthorizationDecisionAudit; this adapter does not establish external authority. TLS verification remains enabled, native response ref/contract identity is checked, digests returned, uncertain writes never automatically retried. No customer HTTP route for ADR, no scientific qualification.

Remaining: real provider, exact ADR resource mapping from confirmed P2 basis, target correspondence, qualified releases, A07/A08 authorization, durable review intent/partial receipts/reconciliation and browser flow. Tests use explicit fixtures, no live ADR call or production release claimed.
