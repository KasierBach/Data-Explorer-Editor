# R13 — Free/Pro entitlement decision record

Status: BLOCKED on product decision. This record captures the current implementation; it does not create a new entitlement.

## Current contract found in code

| Area | Free | Pro monthly | Pro yearly | Server enforcement |
|---|---|---|---|---|
| Price | 0 VND | 149,000 VND | 1,490,000 VND | Checkout validates the paid plan code and amount. |
| Duration | No expiry | 30 days | 365 days | Verified paid webhooks extend `BillingSubscription.expiresAt`; expired users are normalized to Free by `UsersService`. |
| Workspace/database/query/AI/collaboration limits | No authoritative Free/Pro limit is defined | Unsupported benefit claims were removed; copy states the feature matrix is pending approval | Same pending matrix | **No billing feature gate found.** Existing permission, read-only, safety, and operational limits still apply; Query, AI, connections, collaboration, and version history do not have an approved Free/Pro boundary. |
| Payment state | N/A | pending / paid / failed | pending / paid / failed | Paid activation requires a verified provider webhook; a return URL alone cannot activate Pro. Duplicate paid webhook handling is idempotent and concurrent credits are serialized. |
| Expiry | N/A | Active until `expiresAt` | Active until `expiresAt` | `UsersService.getMe` demotes expired users and marks the subscription expired. |
| Refund/cancel/downgrade | N/A | Not defined | Not defined | No provider refund/cancellation reconciliation or self-service downgrade contract found. |

## Inconsistencies that must not ship as entitlement claims

- Unsupported client plan feature/limit claims have been removed. Keep them absent until an approved matrix has a server-side source of truth and enforcement.
- Profile translations no longer claim unlimited databases/AI/collaboration or limited Free AI. This wording correction is not entitlement enforcement.
- The billing UI derives active Pro from `user.plan` plus `subscriptionStatus`; expiry normalization currently happens when the server refreshes the user record rather than through a dedicated entitlement evaluator used by every protected endpoint.
- Version history has no package boundary or retention rule. R13 must not invent one.

## Product decision required

Choose and approve one enforceable matrix before implementation. Recommended minimal decision:

1. Keep the current prices and durations.
2. Define exact Free and Pro values for: saved connections, AI requests per period (including reset timezone), team/collaboration access, and version-history retention/count.
3. Decide behavior at the boundary: HTTP status/reason, whether existing over-quota data stays readable, and whether queued/in-flight operations complete.
4. Define cancellation, refund, chargeback, failed renewal, grace period, and downgrade timing.
5. Decide whether multiple purchases stack duration (current behavior) and whether a later plan changes only duration or also entitlement tier.
6. Confirm which provider sandbox must be accepted before provider end-to-end can be claimed.

## Acceptance to prepare after policy approval

- Use one approved server entitlement matrix and expose the same evaluated status to the UI; existing resource permissions and safety limits remain independent of billing.
- For each approved quota, test below/at/above the boundary, concurrent claims, reset timezone/period, and whether failed operations consume quota. Preserve readable existing data according to the approved over-quota policy; do not invent a deletion policy.
- Replay paid activation, duplicate/out-of-order notifications, concurrent duration credits, expiry/renewal and transaction rollback before adding any new lifecycle writer.
- Add cancellation/refund/chargeback/grace/downgrade transitions only for the approved policy and verified provider protocol; test current entitlement after every transition and repeated notification.
- Keep bank sandbox evidence separate from local signature fixtures. No enforcement or paid-feature claim is approved by the housekeeping request.

Until this is approved, the safe behavior is to keep checkout/webhook/expiry correctness, remove unsupported benefit wording from release claims, and not add arbitrary quotas.
