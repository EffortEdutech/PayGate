# Phase 7 Track 4J - pageCast Single Cast Item/SKU Contract Plan

Status: planned; no implementation or payment activation authorized.

## Objective

Define the future PayGate contract needed before pageCast can sell one Premium Cast or a small bundle of Casts safely through PayGate.

This track exists because pageCast Single Cast pricing is item-specific: the price depends on the selected book or bundle offer. PayGate's current stable app checkout contract accepts `app_id`, `user_ref`, and `plan_key`; it does not yet accept an item reference and does not project item-specific entitlements.

## Current state

- App: `pagecast`
- Active PayGate plan: `cast_pass_monthly`
- Deferred PayGate plan: `single_cast_unlock`
- Current registry status: `single_cast_unlock` remains `draft`
- Current user-facing product: Single Cast Unlock, usually `$3-$9` depending on book or bundle
- Current safe payment slice: Cast Pass subscription only

## Why Single Cast cannot use the current plan contract

A fixed `plan_key=single_cast_unlock` is not enough because PayGate must know which exact item was unlocked.

Without a controlled item contract, these unsafe patterns could happen:

- the app submits an arbitrary amount;
- the app submits an arbitrary Stripe Price ID;
- the app claims an entitlement for the wrong book;
- the app grants browser-return access without verified provider evidence;
- PayGate cannot reconcile a payment back to a specific `book_id` or bundle;
- refunds/cancellations cannot revoke only the purchased item.

Therefore Single Cast must wait for an item/SKU contract owned by PayGate registry data.

## Proposed future contract

### Checkout request

Future endpoint shape, not implemented yet:

```http
POST /v1/checkout/sessions
Authorization: Bearer <app-user-jwt>
Idempotency-Key: <stable-idempotency-key>
Content-Type: application/json
```

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

Rules:

- `item_ref` is a non-commercial reference only.
- pageCast still must not send amount, currency, provider price ID, provider account, customer ID, or entitlement keys.
- PayGate resolves the item from its registry or approved item catalog.
- PayGate rejects unknown, inactive, mismatched, or unsafe items.

### Item registry model

Proposed registry package extension:

```txt
registry/apps/pagecast/items.yaml
```

Example shape:

```yaml
schema_version: "1.0"
items:
  - item_key: book:a2020000-0000-4000-8000-000000000001
    name: Example Premium Cast
    type: single_cast
    status: active
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
```

For bundles:

```yaml
  - item_key: bundle:family_starter_01
    name: Family Starter Bundle
    type: cast_bundle
    status: active
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
```

## Provider lookup strategy

Recommended lookup key rules:

- Single book: `pagecast_book_<short-book-id>_single_unlock`
- Bundle: `pagecast_bundle_<bundle-key>`
- Lookup keys must be created in Stripe test first.
- Lookup keys must match PayGate registry exactly.
- Live lookup keys must be separately confirmed before live activation.

PayGate must continue to treat Stripe Price IDs as provider-owned implementation detail. Apps see PayGate checkout URLs only.

## Entitlement projection model

Single Cast purchase should project item-scoped entitlement evidence, not app-wide Cast Pass access.

Recommended entitlement shape returned to app:

```json
{
  "key": "pagecast.cast.unlock",
  "state": "active",
  "scope": {
    "book_id": "a2020000-0000-4000-8000-000000000001"
  }
}
```

Bundle entitlement example:

```json
{
  "key": "pagecast.bundle.unlock",
  "state": "active",
  "scope": {
    "bundle_id": "family_starter_01",
    "book_ids": [
      "a2020000-0000-4000-8000-000000000001",
      "a2020000-0000-4000-8000-000000000002"
    ]
  }
}
```

pageCast access check then maps:

| PayGate evidence | pageCast access result |
| --- | --- |
| active `pagecast.cast_pass` / `pagecast.premium_casts` | allow all Premium Casts |
| active `pagecast.cast.unlock` with matching `book_id` | allow only that Cast |
| active `pagecast.bundle.unlock` containing matching `book_id` | allow only bundle Casts |
| revoked/refunded/missing item entitlement | locked unless free/guest/Cast Pass/purchased rules apply |

## Webhook and reconciliation requirements

PayGate must persist enough item metadata to reconcile and audit:

- app ID;
- user ref;
- plan key;
- item ref;
- provider account;
- environment;
- checkout session ref;
- payment intent / invoice / subscription refs where applicable;
- entitlement projection target;
- refund/reversal state.

Webhook processing must remain idempotent and should project entitlements only after verified provider events.

Reconciliation must be able to inspect provider state and restore or revoke item entitlements without app-side trust.

## Refund and revocation policy

Before activation, PayGate needs explicit item refund behavior:

| Event | Proposed result |
| --- | --- |
| full refund for Single Cast | revoke matching item entitlement |
| partial refund | operator policy required; default no automatic revocation until policy exists |
| charge dispute/lost chargeback | revoke matching item entitlement or mark needs operator review |
| duplicate payment | keep one entitlement, flag duplicate evidence for operator review |

This policy must be documented before live Single Cast payments.

## Admin/operator requirements

The operator console should eventually show:

- app: `pagecast`;
- plan: `single_cast_unlock`;
- item ref / book title / bundle name;
- price/currency resolved by PayGate;
- provider account and environment;
- checkout session;
- webhook events;
- entitlement scope;
- refund/reversal state;
- reconciliation result.

The console must never expose provider secrets or raw customer payment credentials.

## Required future implementation tracks

Track 4J is planning only. Future implementation should be split into controlled tracks:

1. PayGate registry schema for app items/SKUs.
2. Registry validation for item price, lookup key, scope, and status.
3. Checkout request extension for `item_ref`.
4. Provider adapter lookup resolution for item prices.
5. Database persistence for item checkout and item entitlements.
6. Webhook projection of item-scoped entitlement.
7. Reconciliation inspection for item entitlement state.
8. Admin console item evidence view.
9. pageCast thin client update for Single Cast checkout.
10. pageCast access route update for item-scoped entitlements.
11. Sandbox E2E proof for one controlled Premium Cast.
12. Live gate, only after sandbox proof and explicit operator approval.

## Explicit non-goals for Track 4J

- Do not activate `single_cast_unlock`.
- Do not create or mutate Stripe Products/Prices.
- Do not change PayGate runtime APIs.
- Do not change pageCast runtime code.
- Do not enable live Single Cast payment.
- Do not authorize refunds or chargebacks.

## Acceptance criteria

Track 4J is complete when:

- the item/SKU contract direction is documented;
- unsafe dynamic pricing paths are rejected;
- registry-owned item authority is defined;
- item-scoped entitlement projection is defined;
- future implementation tracks are identified;
- Single Cast remains draft/deferred.

## Next documented step

After Track 4J, either:

1. close pageCast onboarding evidence and update the multi-app onboarding runbook; or
2. begin a separate future item/SKU implementation phase only if the operator explicitly approves Single Cast work.
