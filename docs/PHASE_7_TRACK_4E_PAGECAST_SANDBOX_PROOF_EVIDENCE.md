# Phase 7 Track 4E - pageCast Cast Pass Sandbox Proof Evidence

Status: accepted; sandbox checkout, webhook, subscription, and entitlement projection are proven.

## Objective

Complete the first pageCast PayGate end-to-end proof for Cast Pass using the sandbox/test Stripe environment.

This track verifies that pageCast can use PayGate as the payment boundary without controlling provider price IDs, amount, currency, customer references, webhook processing, or entitlement grants.

## Evidence timestamp

- Evidence captured from PayGate admin summary at: `2026-09-11T07:15:36.793Z`
- Environment: `test`
- Provider: `stripe:nhl_global_solution`
- App: `pagecast`
- User ref: `12f2abc4-3ae2-4bb7-b64f-867648639511`

## Registry/catalog evidence

PayGate admin summary shows app `pagecast` with active Cast Pass plan:

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
- Sandbox lookup configured: `true`
- Live lookup configured: `true`

Single Cast remains draft:

- Plan key: `single_cast_unlock`
- Status: `draft`
- Reason: future item/SKU contract required before per-book entitlement projection.

## Checkout evidence

PayGate recorded the pageCast checkout session:

- Checkout session: `cs_test_a1SIz8xiJKohqwOYOptwh62pCoySxk4g0przRsUpBzMDNfdXoWx3RfoUJC`
- Status: `open`
- Created at: `2026-09-11T06:40:21.017Z`
- Expires at: `2026-09-12T06:40:20.000Z`

Note: Stripe confirmed the payment and webhook projection below is authoritative. Browser return state is not used as entitlement proof.

## Webhook evidence

PayGate processed Stripe webhook events for pageCast:

1. `customer.subscription.created`
   - Event ID: `evt_1UEO8rRgCMXjT1y6TgNIvjYF`
   - Status: `processed`
   - Attempt count: `0`
   - Received at: `2026-09-11T06:40:59.128Z`
   - Processed at: `2026-09-11T06:40:59.310Z`

2. `checkout.session.completed`
   - Event ID: `evt_1UEO8sRgCMXjT1y6W8owwVpU`
   - Status: `processed`
   - Attempt count: `0`
   - Received at: `2026-09-11T06:40:59.574Z`
   - Processed at: `2026-09-11T06:40:59.771Z`

## Customer/subscription evidence

PayGate customer and provider customer mapping exists:

- Provider customer: `cus_VErrcUhv4fvYXQ`
- Provider account: `nhl_global_solution`
- Environment: `test`
- Subscription state: `active`
- Subscription plan key: `cast_pass_monthly`

## Entitlement projection evidence

PayGate projected active entitlement state:

- Entitlement key: `plan:cast_pass_monthly`
- State: `active`
- Effective until: `2026-10-11T06:40:54.000Z`

## Acceptance decision

Track 4E is accepted as complete for Cast Pass sandbox proof.

Accepted scope:

- pageCast Cast Pass checkout starts through PayGate.
- Stripe sandbox/test payment succeeds.
- PayGate receives and processes signed Stripe webhook evidence.
- PayGate projects active subscription and entitlement state.
- Browser return page is polished but remains non-authoritative.

Out of scope / next track:

- pageCast app does not yet read PayGate entitlement state to display/unlock Cast Pass access.
- Single Cast Unlock remains draft until PayGate item/SKU entitlement contract exists.
- Reconciliation run was not required for this green webhook proof.

## Next track

Proceed to Phase 7 Track 4F - pageCast entitlement state read/display.