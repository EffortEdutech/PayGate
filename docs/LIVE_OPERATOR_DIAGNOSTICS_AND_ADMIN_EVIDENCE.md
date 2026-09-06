# Live Operator Diagnostics and Admin Evidence

Status: implemented for Phase 5 Track 6 on 2026-09-06.

## Objective

Give the operator a safe, read-only way to verify live-mode readiness before Phase 6 without exposing credentials or enabling live checkout/refund execution.

## Safe Evidence Exposed

Protected diagnostics now expose:

- configured sandbox Stripe account aliases;
- configured live Stripe account aliases;
- shared sandbox/live provider account aliases;
- live webhook-ready account aliases;
- explicit `live_checkout_enabled=false`;
- explicit `live_portal_enabled=false`;
- explicit `live_reconciliation_enabled=false`;
- explicit `phase6_approval_required=true`.

Admin summary now exposes per-plan live lookup readiness as `live_provider_lookup_configured`, plus provider account and live/test app origins. Webhook and reconciliation rows already carry `environment`, so the operator can filter and review test/live evidence separately.

## Secrets Boundary

Diagnostics and admin evidence must never return:

- `sk_test_*` values;
- `sk_live_*` values;
- `whsec_*` values;
- database passwords or connection strings;
- operator tokens.

## Phase 6 Gate Reminder

This evidence is readiness-only. Live checkout, live portal, live reconciliation, live payment, and live refund execution remain blocked until the Phase 6 controlled live pilot is explicitly approved.