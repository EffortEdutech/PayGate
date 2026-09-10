# Phase 6 Tracks 3-4 - Live Checkout, Webhook, and Entitlement Evidence

Status: Tracks 3 and 4 completed for the controlled live pilot.
Date: 2026-09-08.

This document records safe, non-secret evidence for the controlled live checkout pilot. Do not add card data, live secret keys, webhook signing secrets, Supabase access tokens, or unrestricted Stripe dashboard screenshots.

## Approved Scope

| Field | Value |
| --- | --- |
| App ID | `aintern` |
| Provider account | `stripe:nhl_global_solution` |
| Stripe account ID | `acct_1U4N5nDzGAfRwUx9` |
| Environment | `live` |
| Plan key | `pass_3m` |
| Approved amount | `MYR 39.00` |
| User ref | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` |
| Customer email | `effort.edutech@gmail.com` |
| Refund scope | `full` |

## Live Checkout Evidence

Two live checkout sessions were created during Track 3:

1. Initial live checkout: `cs_live_a180PRcfJU84HsxQQQ7RHLmuIuSnetcQm9yO0OCatvXWFkk8khWG7s6HUU`.
2. Replacement live checkout after the approved return URL correction: `cs_live_a1tM6m5CdE3khHCYdg5vZjpdDNuJcoShYhK5FWiAlhWlfuWVbCWZn4h6YK`.

The replacement checkout was required because the first live checkout returned to the unreachable URL `https://aintern.effortedutech.com`. The PayGate registry was corrected to `https://a-intern.vercel.app` before the replacement checkout.

Operator reported that AIntern now displays:

```text
3-month pass is active through Payment Hub. Reviews, official reports, exports, and bundled AI are unlocked by verified payment state.
```

## Live Webhook Evidence

Admin summary for `app_id=aintern&environment=live` showed processed live checkout webhooks:

| Event ID | Event type | Environment | Status | User ref | Received at | Processed at |
| --- | --- | --- | --- | --- | --- | --- |
| `evt_1UDIgZDzGAfRwUx9CQnPJlok` | `checkout.session.completed` | `live` | `processed` | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` | `2026-09-08T06:39:16.387Z` | `2026-09-08T06:39:16.567Z` |
| `evt_1UDII0DzGAfRwUx9KuYBFhKO` | `checkout.session.completed` | `live` | `processed` | `b292ecfa-46c2-4d6c-bfef-8c32cd8c7bf7` | `2026-09-08T06:13:54.201Z` | `2026-09-08T06:13:54.387Z` |

## Monitoring Evidence

Admin monitoring for `app_id=aintern&environment=live` returned:

```text
status: ok
alerts: none
```

## Track Decision

Phase 6 Track 3 is complete using the corrected replacement checkout.

Phase 6 Track 4 is complete because the live signed webhook was processed and AIntern shows the pass active through verified Payment Hub state.

## Next Track

Proceed to Phase 6 Track 5: portal and reconciliation proof, unless intentionally deferred by operator decision.

Refund remains approved as `full` for Track 6, but must not be performed until the Track 6 step is explicitly started.

## 2026-09-10 account correction

The operator confirmed Stripe dashboard test mode, sandbox, and live mode all show NHL Global Solution as account `acct_1U4N5nDzGAfRwUx9`. Any earlier reference to `acct_1U4N6cRgCMXjT1y6` is superseded historical evidence and should not be used as the active PayGate provider account record.
