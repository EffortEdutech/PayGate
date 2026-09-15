# Phase 7 Track 4K - pageCast Onboarding Closure and Operator Evidence Packet

Status: completed for pageCast Cast Pass sandbox/test onboarding; live mode and Single Cast item/SKU payments remain deferred.

## Objective

Close the pageCast onboarding slice with one operator-readable evidence packet that confirms what is proven, what remains intentionally blocked, and what the next decision gate is.

This track does not mutate runtime code, Stripe catalog, credentials, registry plan status, or live payment configuration.

## Scope closed by this packet

Closed for pageCast:

- PayGate registry package exists for `pagecast`.
- Provider account mapping is configured as `stripe:nhl_global_solution`.
- Cast Pass plan is active in PayGate registry.
- Stripe sandbox/test price lookup for Cast Pass is configured.
- pageCast Supabase JWT boundary is configured and verified.
- pageCast uses PayGate for Cast Pass checkout.
- PayGate receives and processes pageCast Stripe sandbox webhooks.
- PayGate projects active Cast Pass subscription/entitlement state.
- pageCast displays active Cast Pass state.
- pageCast enforces Cast Pass access for Premium Casts.
- Operator/admin evidence path is documented.

Not closed / intentionally deferred:

- Single Cast item/SKU runtime implementation.
- pageCast live-mode payment readiness.
- pageCast live checkout/payment/refund proof.
- item-level refund/revocation behavior.
- broader Phase 7 freeze note.

## App identity

- App ID: `pagecast`
- App name: `pageCast`
- Provider: `stripe`
- Provider account alias: `nhl_global_solution`
- Current proven environment: `test`
- App URL: `https://pagecast-nine.vercel.app`

## Registry status

### Active

- Plan key: `cast_pass_monthly`
- Name: `pageCast Cast Pass Monthly`
- Mode: `subscription`
- Amount: `1900`
- Currency: `USD`
- Interval: `month`
- Status: `active`
- Entitlements:
  - `pagecast.cast_pass`
  - `pagecast.premium_casts`

### Deferred

- Plan key: `single_cast_unlock`
- Name: `pageCast Single Cast Unlock`
- Mode: `one_time`
- Status: `draft`
- Reason: future item/SKU contract required before per-book or bundle entitlement projection.

## PayGate sandbox proof evidence

Evidence source: `docs/PHASE_7_TRACK_4E_PAGECAST_SANDBOX_PROOF_EVIDENCE.md`

- Evidence timestamp: `2026-09-11T07:15:36.793Z`
- Environment: `test`
- User ref: `12f2abc4-3ae2-4bb7-b64f-867648639511`
- Checkout session: `cs_test_a1SIz8xiJKohqwOYOptwh62pCoySxk4g0przRsUpBzMDNfdXoWx3RfoUJC`
- Provider customer: `cus_VErrcUhv4fvYXQ`
- Subscription state: `active`
- Plan key: `cast_pass_monthly`
- Entitlement projection:
  - `plan:cast_pass_monthly`
  - state: `active`
  - effective until: `2026-10-11T06:40:54.000Z`

Processed webhooks:

1. `customer.subscription.created`
   - Event ID: `evt_1UEO8rRgCMXjT1y6TgNIvjYF`
   - Status: `processed`
   - Attempt count: `0`
2. `checkout.session.completed`
   - Event ID: `evt_1UEO8sRgCMXjT1y6W8owwVpU`
   - Status: `processed`
   - Attempt count: `0`

## pageCast app-side proof evidence

Evidence sources:

- `docs/PHASE_7_TRACK_4F_PAGECAST_ENTITLEMENT_STATE_EVIDENCE.md`
- `docs/PHASE_7_TRACK_4H_PAGECAST_ACCESS_ENFORCEMENT_EVIDENCE.md`

Accepted app behavior:

- `/pricing` shows active Cast Pass state for the paid test user.
- `/pricing?billing=success` shows PayGate active Cast Pass state and does not itself grant access.
- Premium Cast unpaid state remains locked.
- Premium Cast paid Cast Pass state opens reader.

Premium Cast proof:

- Detail URL: `https://pagecast-nine.vercel.app/book/a2020000-0000-4000-8000-000000000001`
- Unpaid CTA: `Unlock Cast for $9.99`
- Unpaid secondary action: `Get Cast Pass`
- Paid CTA: `Read with Cast Pass`
- Paid reader target: `https://pagecast-nine.vercel.app/reader/a2020000-0000-4000-8000-000000000001`

## Operator/admin review path

Use the protected PayGate `/admin` console or the protected admin APIs.

Recommended API checks:

```powershell
$operatorToken = "<OPERATOR_DIAGNOSTICS_TOKEN>"
$headers = @{ Authorization = "Bearer $operatorToken" }

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/summary?app_id=pagecast&environment=test" `
  -Headers $headers

Invoke-RestMethod `
  -Uri "https://pay-gate-beta.vercel.app/admin/monitoring?app_id=pagecast&environment=test" `
  -Headers $headers
```

Operator should confirm:

- app registry shows `pagecast`;
- Cast Pass plan is active;
- Single Cast remains draft;
- webhook evidence is processed;
- customer/subscription/entitlement evidence exists;
- monitoring has no critical alerts for pageCast test environment.

## Architecture boundaries confirmed

pageCast does not control:

- provider account;
- Stripe secret key;
- webhook secret;
- provider price ID;
- amount;
- currency;
- provider customer ID;
- entitlement keys;
- webhook processing;
- reconciliation authority.

PayGate remains the authority for:

- registry catalog;
- provider lookup resolution;
- checkout session creation;
- signed webhook verification;
- subscription and entitlement projection;
- operator/admin evidence;
- future reconciliation and refund policy.

Browser return pages are not entitlement authority.

## Deferred work register

| Deferred item | Status | Required before activation |
| --- | --- | --- |
| Single Cast item/SKU payments | deferred | implement Track 4J future contract tracks |
| pageCast live Cast Pass | deferred | dedicated live readiness gate and operator approval |
| pageCast refund/revocation proof | deferred | refund policy + live/test execution gate |
| Store card `Included with Cast Pass` polish | optional | UX polish only, not payment authority |
| Multi-app runbook hardening | next | update from pageCast evidence |
| Phase 7 freeze note | later | after multi-app admin/monitoring and runbook update |

## Closure checklist

- [x] Registry package exists for pageCast.
- [x] Cast Pass is active in registry.
- [x] Single Cast remains draft.
- [x] Provider account mapping is recorded.
- [x] Supabase JWT boundary is verified.
- [x] Cast Pass checkout is wired through PayGate.
- [x] Sandbox checkout/webhook/subscription/entitlement proof is accepted.
- [x] pageCast entitlement display is accepted.
- [x] pageCast Premium Cast access enforcement is accepted.
- [x] Operator/admin evidence path is documented.
- [x] Single Cast item/SKU contract plan is documented.
- [x] Live mode remains blocked pending a separate readiness gate.

## Operator decision

Track 4K closes pageCast onboarding for Cast Pass sandbox/test usage.

Recommended next step:

- Phase 7 Track 4L - update the multi-app onboarding runbook using the real pageCast evidence, then prepare the Phase 7 pageCast onboarding freeze decision.
