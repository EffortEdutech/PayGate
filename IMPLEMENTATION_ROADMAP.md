# Implementation Roadmap

This roadmap is controlled by `docs/PRODUCT_PLAN.md`. Do not create new phases outside that product plan.

## Product Objective

PayGate is a provider-neutral payment gateway for multiple apps and multiple company-owned payment provider accounts. Apps consume stable Hub APIs; the Hub owns commercial authority, provider account routing, provider secrets, verified webhook processing, entitlement projection, reconciliation, monitoring, and operator audit controls.

## Phase Status

| Phase | Name | Status | Evidence |
|---|---|---|---|
| 0 | Contract and authority freeze | Frozen | `PHASE_0_FREEZE.md` |
| 1 | Executable foundation | Frozen | Foundation source, registry validation, migration baseline |
| 2 | Stripe sandbox vertical slice | Frozen | `PHASE_2_COMPLETION.md`, `PHASE_2_FREEZE.md` |
| 3 | First app integration - AIntern | Frozen | `docs/PHASE_3_AINTERN_INTEGRATION_PLAN.md`, deployed AIntern sandbox proof |
| 4 | Production hardening | Current closeout | `docs/PHASE_4_PRODUCTION_HARDENING_SPRINT_PLAN.md` |
| 5 | Live-mode implementation readiness | Planned, not started | `docs/PHASE_5_LIVE_MODE_IMPLEMENTATION_READINESS_SPRINT_PLAN.md` |
| 6 | Controlled live pilot | Planned, future approval required | `docs/PHASE_6_CONTROLLED_LIVE_PILOT_SPRINT_PLAN.md`, `docs/CONTROLLED_LIVE_PAYMENT_REFUND_GATE.md` |
| 7 | Multi-app scale-out | Planned, future | `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`, `docs/MULTI_APP_ONBOARDING_RUNBOOK.md` |

## Current Rule

We are not free-form creating phases. The next implementation phase may start only after:

1. Phase 4 is frozen with evidence.
2. A Phase 5 sprint plan and checklist are documented.
3. The operator approves Phase 5 implementation.

Until then, live credentials, live payments, live refunds, and app #2 implementation remain blocked.
