# Phase 7 Track 5A - PayGate Item/SKU Registry Contract for pageCast Single Cast

Status: implemented as registry contract only; no runtime checkout activation.

## Objective

Prepare PayGate's registry contract for pageCast Single Cast and bundle purchases without enabling item checkout yet.

This track answers the operator question: how can pageCast sell one specific Premium Cast or bundle without allowing the app to control amount, currency, Stripe Price ID, provider account, or entitlement scope?

## Implemented contract artifacts

Added:

- `registry/schemas/items.schema.json`
- `registry/apps/pagecast/items.yaml`

Updated:

- `scripts/registry-validation.ts`
- `registry/apps/pagecast/entitlements.yaml`
- `docs/PHASE_7_PAGECAST_PAYGATE_SPRINT_PLAN.md`

## Draft item examples

### Single Cast book unlock

```yaml
item_key: book:a2020000-0000-4000-8000-000000000001
name: Example Premium Cast Single Unlock
type: single_cast
pricing:
  currency: USD
  unit_amount_minor: 999
provider:
  stripe:
    lookup_key: pagecast_book_a2020000_single_unlock
entitlement:
  key: pagecast.cast.unlock
  scope:
    book_id: a2020000-0000-4000-8000-000000000001
status: draft
```

### Bundle unlock

```yaml
item_key: bundle:family_starter_01
name: Family Starter Cast Bundle
type: cast_bundle
pricing:
  currency: USD
  unit_amount_minor: 1499
provider:
  stripe:
    lookup_key: pagecast_bundle_family_starter_01
entitlement:
  key: pagecast.bundle.unlock
  scope:
    bundle_id: family_starter_01
    book_ids:
      - a2020000-0000-4000-8000-000000000001
      - a2020000-0000-4000-8000-000000000002
status: draft
```

## Validation behavior

Registry validation now treats `items.yaml` as optional. If present, it validates:

- item key shape;
- item type: `single_cast` or `cast_bundle`;
- integer minor-unit price;
- uppercase currency;
- provider lookup key shape;
- optional live lookup key shape;
- entitlement key existence;
- scope shape for book vs bundle;
- duplicate item keys;
- test/live lookup key uniqueness across plans and items.

## Safety boundary

This track does not:

- activate `single_cast_unlock`;
- create Stripe Products or Prices;
- call Stripe;
- change checkout request/response contracts;
- grant item entitlements;
- modify pageCast runtime code;
- authorize live mode.

## Why this is the correct first step

Single Cast requires item-specific commercial authority. By putting item definitions in PayGate registry first, PayGate can later resolve `item_ref` safely while pageCast sends only a non-commercial reference.

Future safe request shape:

```json
{
  "app_id": "pagecast",
  "user_ref": "<supabase-user-id>",
  "plan_key": "single_cast_unlock",
  "item_ref": "book:a2020000-0000-4000-8000-000000000001",
  "return_context": "billing",
  "environment": "test"
}
```

PayGate will own the price, currency, lookup key, entitlement scope, and provider route.

## Acceptance criteria

- [x] Dedicated pageCast PayGate sprint plan exists.
- [x] Optional `items.yaml` schema exists.
- [x] Draft pageCast item catalog exists.
- [x] Entitlement keys for item unlocks are declared.
- [x] Registry validation covers item references and lookup uniqueness.
- [x] All item examples remain `draft`.
- [x] Runtime payment activation remains blocked.

## Next track

Phase 7 Track 5B - Registry loader/domain types for PayGate items.
