# R13 — Free/Pro entitlement and package version boundary

Status: BLOCKED on product decision; current payment/expiry boundary is VERIFIED_LOCAL. See [decision record](R13-DECISION.md).

## What is technically verified

- Prices and durations remain unchanged: 149,000 VND / 30 days and 1,490,000 VND / 365 days.
- Paid activation requires a verified provider webhook; the return URL cannot unlock Pro.
- Duplicate/out-of-order payment notifications and concurrent credits retain the R06 transactional tests; expiry normalization demotes stale Pro records.
- Unsupported feature/quota claims were removed from pricing/profile copy. UI now states that the feature matrix is pending product approval; no arbitrary quota was introduced.
- Billing component tests, client typecheck/build and final server billing/native gates remain required by the clean export.

## Product input still required

Approval is needed for exact Free/Pro values and lifecycle behavior listed in `R13-DECISION.md`: saved connection limits, AI period/reset, team access, version-history retention, over-quota reads, in-flight operations, cancellation/refund/chargeback/grace period/downgrade, stacked purchases, and the provider sandbox acceptance target.

No server feature enforcement will be added until this decision is provided. Therefore R13 is not DONE and Gate C is not satisfied.
