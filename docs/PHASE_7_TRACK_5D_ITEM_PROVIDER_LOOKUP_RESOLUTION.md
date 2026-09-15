# Phase 7 Track 5D - Provider Lookup Resolution for Item Prices

Status: implemented; item checkout remains disabled.

## Objective

Prepare PayGate to resolve provider lookup keys for item-specific purchases from the PayGate registry only, while still preventing item checkout sessions from being created.

## Implemented Scope

- Reused the provider lookup resolver for both plans and items.
- Made the resolver testable through `providerLookupKeyFor(...)`.
- Enforced active-item lookup for `item_ref` checkout attempts.
- Resolved item provider lookup keys from registry-owned `provider_lookup_key` / `live_lookup_key` fields.
- Preserved test/live separation:
  - test uses `provider_lookup_key`;
  - live uses `live_lookup_key` when present, falling back to `provider_lookup_key` only according to current PayGate lookup policy.
- Rejected draft/inactive item checkout before provider execution.
- Kept the item checkout disabled gate after successful active-item lookup resolution.

## Safety Boundary

This track does not:

- create Stripe item checkout sessions;
- persist item checkout sessions;
- project item-scoped entitlements;
- activate pageCast Single Cast purchases;
- mutate Stripe Product/Price catalog;
- authorize live item payments.

Apps still cannot send amount, currency, Stripe Price ID, provider account, provider customer, or entitlement keys.

## Expected Runtime Behavior

Known active item with configured lookup key:

1. PayGate authenticates app/user authority.
2. PayGate confirms `item_ref` exists and is active.
3. PayGate resolves provider lookup key from registry.
4. PayGate stops with `ITEM_CHECKOUT_DISABLED` before provider checkout creation.

Draft item:

1. PayGate authenticates app/user authority.
2. PayGate rejects the item with `ITEM_NOT_AVAILABLE`.
3. Provider checkout is not called.

## Validation Evidence

- `npm run typecheck -- --pretty false` passed during implementation.
- Full `npm run check` must pass before handoff.

## Next Track

Proceed to Phase 7 Track 5E - Persistence Model for Item Checkout and Item Entitlement Evidence.