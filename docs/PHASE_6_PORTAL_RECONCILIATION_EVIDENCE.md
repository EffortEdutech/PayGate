# Phase 6 Track 5 - Live Portal and Reconciliation Evidence

Status: completed for the controlled live pilot.
Date: 2026-09-08.

This document records safe, non-secret evidence for live portal and reconciliation proof. Do not add card data, live secret keys, webhook signing secrets, Supabase access tokens, or unrestricted Stripe dashboard screenshots.

## Approved Scope

| Field | Value |
| --- | --- |
| App ID | `aintern` |
| Provider account | `stripe:nhl_global_solution` |
| Environment | `live` |
| Plan key | `pass_3m` |
| User ref | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` |
| Customer email | `effort.edutech@gmail.com` |

## Portal Evidence

Live billing portal session was created successfully:

```text
portal_session_id: bps_1UDLuRDzGAfRwUx9cEJHv0sp
redirect_url: https://billing.stripe.com/p/session?secret=live_...
```

The portal URL used Stripe Billing Portal with a live-mode session secret prefix. The full portal URL is intentionally not recorded in source control.

## Reconciliation Evidence

Live reconciliation was run successfully:

```text
reconciliation_run_id: d47601bc-d75f-4ec0-b6ec-5697ca4bbef3
app_id: aintern
user_ref: b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7
status: no_provider_subscription
subscription: active / pass_3m
request_id: phase6-live-reconciliation-aintern-pass3m-001
```

## Reconciliation Interpretation

`no_provider_subscription` is acceptable for this Phase 6 pilot because the approved AIntern plan is a one-time payment plan, not a recurring Stripe subscription.

The important business-state result is that PayGate still reports:

```text
subscription.state: active
subscription.planKey: pass_3m
```

This proves reconciliation stayed scoped to the same app, user, provider account, and live environment without crossing into another account or environment.

## Track Decision

Phase 6 Track 5 is complete.

## Next Track

Proceed to Phase 6 Track 6: full refund pilot, because the approved Phase 6 refund scope is `full`.