# Phase 6 Entry Gate Packet

Status: prepared for operator review on 2026-09-06.

This packet records whether PayGate is ready to ask for explicit approval to enter Phase 6, the controlled live pilot. It does not authorize live payment, live checkout, live portal, live reconciliation, or live refund execution.

## Gate Decision

Current decision: ready for operator go/no-go review.

Phase 6 remains blocked until the operator records a specific approval outside source control using `docs/CONTROLLED_LIVE_PAYMENT_REFUND_GATE.md`.

## Evidence Checklist

- [x] `npm run check` passes.
- [x] Phase 5 Track 1 - live adapter boundary implemented.
- [x] Phase 5 Track 2 - live provider account configuration model implemented.
- [x] Phase 5 Track 3 - live registry strategy implemented.
- [x] Phase 5 Track 4 - live webhook boundary implemented.
- [x] Phase 5 Track 5 - refund and chargeback policy/event mapping implemented.
- [x] Phase 5 Track 6 - live operator diagnostics and admin evidence implemented.
- [x] Controlled live payment/refund gate reviewed as the Phase 6 approval runbook.
- [x] Operator approval is still required before Phase 6 execution.

## Implementation Evidence

| Area | Evidence |
| --- | --- |
| Live adapter boundary | Sandbox adapter rejects live keys; live boundary rejects test keys; live business operations remain unavailable. |
| Live provider account model | `STRIPE_LIVE_ACCOUNTS` and `STRIPE_LIVE_ACCOUNT_<ALIAS>_*` are parsed separately from sandbox credentials. |
| Live registry strategy | Registry supports optional `live_lookup_key`; app requests still submit only `plan_key`. |
| Live webhook boundary | Provider routing is scoped by `{provider_account}:{environment}`; live webhooks require live config. |
| Refund policy | Full refund and dispute revoke entitlement; partial refund records event without automatic revoke. |
| Operator evidence | Protected diagnostics/admin show aliases, readiness flags, environment separation, and no secrets. |

## Required Operator Approval Fields for Phase 6

Before Phase 6 can start, record these outside source control:

- app ID;
- provider account alias;
- Stripe account owner/company;
- environment `live`;
- exact live plan key;
- exact amount and currency;
- test user identity/email;
- payment method to use;
- whether refund proof is included;
- evidence capture location;
- rollback/support owner;
- time window for the test;
- explicit approval sentence.

## Stop Conditions

Do not enter Phase 6 if any of these are true:

- `npm run check` fails;
- live and sandbox Stripe account aliases are confused;
- live credentials are missing, malformed, or exposed in logs/docs;
- live Product/Price lookup key does not match the approved plan/amount/currency;
- webhook endpoint is not configured for the exact provider account and environment;
- operator approval is missing or incomplete;
- requested amount, app, user, provider account, or refund scope differs from the approval record.

## Next Allowed Action

Ask the operator whether to accept the Phase 5 freeze and prepare the out-of-source-control Phase 6 approval packet. Do not run a live transaction until that approval exists.