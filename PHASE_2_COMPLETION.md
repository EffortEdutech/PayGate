# Phase 2 Completion Evidence

**Status:** FROZEN AFTER STRIPE SANDBOX PROOF
**Date:** 2026-08-27
**Local port family:** `301#`, default `3017`

## Completed Tracks

- Track 1: HTTP shell and app authentication.
- Track 2: PostgreSQL persistence code path and migrations.
- Track 3: Stripe sandbox adapter for Checkout, Portal, webhook verification, error translation, and event normalization.
- Track 4: subscription and entitlement projection from normalized verified events and reconciliation snapshots.
- Track 5: reconciliation endpoint, provider subscription retrieval, run recording, idempotency, and sandbox runbook.

## Automated Verification

Latest local verification:

```text
npm run check
22 tests passed
0 failed
```

Covered by tests:

- registry validation;
- app auth and app-id authority checks;
- local port lock to `3010-3019`;
- mutation idempotency and replay;
- checkout endpoint registry-owned field resolution;
- raw webhook route path through provider verification;
- Stripe sandbox adapter rejection of live secret keys;
- Stripe event normalization for checkout, subscription, invoice failure, and entitlement revocation;
- PostgreSQL checkout persistence;
- webhook inbox deduplication;
- transactional projection;
- reconciliation repair from provider evidence;
- internal reconciliation endpoint idempotency.

## Real Stripe Sandbox Proof

Completed on 2026-08-27 using Stripe test mode and Hub port `3017`.

Observed Stripe CLI events accepted by the Hub with HTTP 200:

```text
customer.created: evt_1U8ki6RgCMXjT1y6JH2UKPsZ
charge.succeeded: evt_3U8kkJRgCMXjT1y6053xgHhH
invoice.finalized: evt_1U8kkMRgCMXjT1y6hDz6b5dR
invoice.paid: evt_1U8kkMRgCMXjT1y6gv0vW6gX
customer.subscription.created: evt_1U8kkMRgCMXjT1y6lCAtolh4
checkout.session.completed: evt_1U8kkMRgCMXjT1y6G10ncvRY
invoice.payment_succeeded: evt_1U8kkMRgCMXjT1y6kzQ4m7cm
```

Hub proof for `app_analytics_pro` / `user_2`:

```json
{
  "subscription": {
    "appId": "app_analytics_pro",
    "userRef": "user_2",
    "state": "active",
    "planKey": "growth_monthly"
  },
  "entitlements": [
    {
      "key": "plan:growth_monthly",
      "state": "active"
    }
  ],
  "portal_session_created": true,
  "reconciliation": {
    "status": "repaired",
    "currentPeriodEnd": "2026-09-26T17:36:18.000Z"
  }
}
```

## Safety Confirmation

- No live Stripe key was used.
- No production transaction was attempted.
- No client-supplied amount, currency, provider price ID, provider customer ID, arbitrary return URL, or entitlement mutation was accepted.
- Browser redirects do not grant entitlements.
- Stripe remains isolated behind the provider adapter.
