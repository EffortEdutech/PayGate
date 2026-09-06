# PayGate Product Plan

Status: governing product plan for Payment Hub work.
Last updated: 2026-09-06.

## Product Objective

Build PayGate as a provider-neutral payment gateway that lets multiple apps accept payments through the correct company-owned payment provider account while keeping commercial authority, provider secrets, entitlement decisions, webhooks, reconciliation, monitoring, and operator audit controls inside the Hub.

Stripe is the first provider and the expansion driver. The architecture must stay ready for additional Stripe accounts, additional apps, and future providers without allowing application code to own provider-specific payment logic.

## Product Outcomes

PayGate is successful when all of these are true:

- Apps can start checkout, open billing management, and read payment/entitlement state through stable Hub APIs.
- Apps never control amount, currency, provider price IDs, provider customer IDs, provider account aliases, entitlements, or arbitrary return URLs.
- Each app is mapped to the correct company/provider account by registry and server-side configuration.
- Stripe test and live modes are isolated in credentials, webhook endpoints, data, idempotency scope, and operator evidence.
- Verified provider webhooks and explicit reconciliation are the only financial sources that can mutate entitlement state.
- Operators can safely inspect apps, plans, customers, checkout sessions, webhooks, entitlements, reconciliation runs, and monitoring state without exposing secrets.
- Adding app #2 follows a checklist rather than custom improvisation.
- Live payments and refunds happen only inside an explicit operator-approved live test window.

## Non-Negotiable Product Boundaries

- PayGate is the payment authority; apps are payment consumers.
- Registry files are the commercial authority for app, plan, amount, currency, provider lookup key, entitlement, and return URL mapping.
- Provider credentials live only in server-side secret storage.
- Browser redirects never grant access.
- Provider SDKs stay inside provider adapters, not the provider-neutral domain.
- All monetary values use integer minor units and uppercase ISO currency.
- Every provider record includes provider, provider account, and environment.
- Live-mode work is blocked until the live-mode sprint plan and operator approval gate are complete.

## Finite Product Roadmap

This roadmap is intentionally finite. We do not create new phases unless a new product objective is approved and documented here first.

| Phase | Name | Status | Purpose | Exit condition |
|---|---|---|---|---|
| 0 | Contract and authority freeze | Frozen | Define boundary rules, API contracts, registry authority, event trust model, and database model. | Phase 0 freeze recorded and verification passes. |
| 1 | Executable foundation | Frozen | Build TypeScript workspace, registry validation, provider interfaces, config, auth/idempotency foundations, and DB baseline. | Foundation compiles and registry validation passes. |
| 2 | Stripe sandbox vertical slice | Frozen | Prove checkout, verified webhooks, entitlements, portal, and reconciliation using Stripe sandbox. | Real sandbox proof recorded and Phase 2 freeze complete. |
| 3 | First app integration - AIntern | Frozen | Connect AIntern to PayGate through a thin client and named provider account, without app-owned Stripe logic. | AIntern deployed sandbox checkout, webhook, entitlement, portal, and reconciliation proof complete. |
| 4 | Production hardening | Current closeout | Protect diagnostics, improve reconciliation inspection, admin console, onboarding, live readiness, monitoring, account isolation, and live-test gate. | Phase 4 checklist complete and freeze note recorded. |
| 5 | Live-mode implementation readiness | Planned, not started | Design and implement explicit live-mode boundaries only after Phase 4 freeze. | Sandbox/live separation tests pass; live credentials still not used without approval. |
| 6 | Controlled live pilot | Future approval required | Run one approved low-value real payment/refund test. | Evidence recorded; refund and entitlement behavior confirmed. |
| 7 | Multi-app scale-out | Future | Onboard app #2 and later apps using the multi-app runbook. | New app passes onboarding, sandbox proof, monitoring, and isolation gates. |

## Current Sprint Authority

Current sprint: Phase 4 - Production Hardening.

Phase 4 is complete when:

- [x] Operator diagnostics are protected.
- [x] Stripe reconciliation inspection exists.
- [x] Audit/admin console exists.
- [x] Multi-app onboarding checklist exists.
- [x] Live-mode readiness checklist exists.
- [x] Monitoring and alerting baseline exists.
- [x] Provider account isolation tests pass.
- [x] Controlled live payment/refund planning gate exists and execution remains deferred.
- [ ] Phase 4 freeze note is recorded.

## Stop Creating New Phases Rule

A new phase can be created only when all are true:

1. The current phase is frozen or explicitly deferred.
2. The new phase maps to one of the finite roadmap rows above.
3. The new phase has objective, tracks, checklist, acceptance gates, stop conditions, and non-authorized actions documented before implementation.
4. The operator approves proceeding into that documented phase.

If these are not true, work must continue inside the current phase or stop for planning.

## What Is Not Authorized Now

- No live Stripe secret use.
- No live checkout creation.
- No live webhook endpoint activation for entitlement mutation.
- No real payment or refund.
- No app #2 implementation before Phase 4 freeze and app #2 intake.
- No new payment provider implementation before Stripe/AIntern production readiness is controlled.

## Immediate Next Action

Freeze Phase 4 with evidence, then create the Phase 5 sprint plan and checklist before any Phase 5 implementation.