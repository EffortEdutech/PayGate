# Phase 7 Track 5B - Registry Loader and Domain Types for PayGate Items

Status: implemented; item checkout remains disabled.

## Objective

Teach PayGate runtime/domain code to load item registry definitions safely, without exposing item checkout yet.

## Implemented

Updated:

- `payment-hub/src/registry/types.ts`
- `payment-hub/src/registry/registry.ts`
- `payment-hub/src/runtime/runtime.ts`
- `tests/registry/registry.test.ts`

## Domain model added

New domain types:

- `RegisteredItemScope`
- `RegisteredItem`

Registered item fields include:

- `itemKey`
- `name`
- `type`
- `amountMinor`
- `currency`
- `providerLookupKeys`
- optional `providerLiveLookupKeys`
- item-scoped entitlement key and scope
- `status`

## Runtime loader behavior

PayGate runtime now loads optional app-level item catalogs from:

```txt
registry/apps/<app_id>/items.yaml
```

If the file is absent, the app receives an empty item map.

For pageCast, the runtime loads the draft examples from:

```txt
registry/apps/pagecast/items.yaml
```

## Registry lookup behavior

Added safe lookup methods:

- `registry.item(appId, itemKey)` returns an item at any status, including `draft`.
- `registry.activeItem(appId, itemKey)` only returns active items and rejects draft/archived items.

This lets future tracks inspect item definitions while keeping item checkout blocked until item status and checkout support are explicitly activated.

## Test evidence

Added test:

```txt
pageCast item registry loads draft item definitions without activating checkout
```

The test proves:

- pageCast item catalog loads;
- two draft items are present;
- the single-book item resolves with USD 9.99, entitlement `pagecast.cast.unlock`, and matching `bookId` scope;
- `activeItem` rejects the draft item.

## Safety boundary

This track does not:

- change checkout API;
- accept `item_ref` yet;
- create Stripe sessions for items;
- activate `single_cast_unlock`;
- activate any item;
- mutate Stripe catalog;
- change pageCast runtime code;
- grant item entitlements.

## Validation

`npm run check` passed:

- registry validation passed for 3 application packages;
- TypeScript typecheck passed;
- 61/61 tests passed.

## Next track

Phase 7 Track 5C - Checkout API extension for `item_ref` behind disabled item-checkout gate.
