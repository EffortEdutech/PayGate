# Phase 7 Track 5F - Webhook Projection for Item-Scoped Entitlements

Status: implemented; item checkout session creation remains disabled.

## Objective

Allow PayGate to project item-scoped entitlements only from verified provider evidence, preparing pageCast Single Cast unlocks without granting access from browser redirects or app-submitted commercial authority.

## Implemented Scope

- Extended normalized provider event payloads with item evidence fields:
  - `itemRef`
  - `itemEntitlementKey`
  - `itemEntitlementScope`
- Updated Stripe webhook normalization to read safe item metadata:
  - `cph_item_ref`
  - `cph_item_entitlement_key`
  - `cph_item_entitlement_scope`
- Added scoped entitlement projection support in in-memory and Postgres repositories.
- Persisted item entitlement evidence before/alongside item entitlement grants.
- Added optional `scope` to stable entitlement projections.
- Added tests for:
  - Stripe item metadata normalization;
  - verified item checkout event projecting a scoped entitlement;
  - verified full refund revoking a scoped item entitlement;
  - Postgres item webhook projection into evidence and entitlement grant tables.

## Safety Boundary

This track does not:

- enable item checkout creation;
- create Stripe item checkout sessions;
- let pageCast submit amount, currency, Stripe Price ID, entitlement key, or provider account;
- grant access from browser return URLs;
- mutate Stripe Product/Price catalog;
- authorize live item payments.

The entitlement grant path requires a verified provider event that has passed webhook signature verification before `applyVerifiedEvent(...)` is called.

## Metadata Contract Prepared For Future Item Checkout

Future provider checkout sessions for item purchases must write metadata server-side only:

```text
cph_app_id
cph_user_ref
cph_item_ref
cph_item_entitlement_key
cph_item_entitlement_scope
cph_environment
cph_provider_account
cph_request_id
```

Apps must never supply these provider metadata values directly.

## Validation Evidence

- `npm run typecheck -- --pretty false` passed.
- Focused/full Node test command passed 70 tests.
- Full `npm run check` must pass before final handoff.

## Next Track

Proceed to Phase 7 Track 5G - pageCast Thin Client for Single Cast Checkout, still behind the disabled item checkout gate unless operator explicitly approves activation.