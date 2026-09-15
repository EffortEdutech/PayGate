# Phase 7 Track 5C - Checkout API Extension for `item_ref` Behind Disabled Gate

Status: implemented; item checkout remains disabled.

## Objective

Prepare PayGate's checkout API for future item-specific purchases by recognizing `item_ref` as a non-commercial selector while preventing any item checkout execution until later item entitlement, persistence, webhook, and operator controls are implemented.

## Implemented Scope

- Added optional `itemRef` to the shared checkout command contract.
- Kept resolved provider checkout commands plan-backed only; providers still receive a required `planKey`.
- Updated `POST /v1/checkout/sessions` to accept either `plan_key` or `item_ref`.
- Added service-level validation:
  - reject missing checkout target;
  - reject both `plan_key` and `item_ref` together;
  - verify `item_ref` belongs to the registry;
  - then block item checkout with `ITEM_CHECKOUT_DISABLED`.
- Added test evidence that plan checkout still works.
- Added test evidence that known item checkout is blocked before provider execution.

## Safety Boundary

This track does not:

- create Stripe item checkout sessions;
- resolve item provider lookup keys for checkout;
- persist item checkout sessions;
- project item-scoped entitlements;
- activate pageCast Single Cast purchases;
- mutate Stripe catalog;
- enable live item payments.

`item_ref` is now recognized as future API shape only. It is not authority to buy or unlock anything yet.

## Current Request Shapes

Plan checkout remains unchanged:

```json
{
  "app_id": "pagecast",
  "user_ref": "<supabase-user-uuid>",
  "plan_key": "cast_pass_monthly",
  "return_context": "billing",
  "environment": "test"
}
```

Future item checkout shape is recognized but blocked:

```json
{
  "app_id": "pagecast",
  "user_ref": "<supabase-user-uuid>",
  "item_ref": "book:a2020000-0000-4000-8000-000000000001",
  "return_context": "cast",
  "environment": "test"
}
```

Expected current response for known item references:

```json
{
  "error": {
    "code": "ITEM_CHECKOUT_DISABLED",
    "message": "Item checkout is recognized by PayGate but is not enabled yet",
    "requestId": "req_..."
  }
}
```

## Validation Evidence

- `npm run check` must pass.
- `git diff --check` must pass.

## Next Track

Proceed to Phase 7 Track 5D - Provider Lookup Resolution for Item Prices, still without enabling item checkout sessions.