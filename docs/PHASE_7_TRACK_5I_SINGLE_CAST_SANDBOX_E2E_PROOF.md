# Phase 7 Track 5I - Controlled Single Cast Sandbox E2E Proof

Status: accepted; controlled external Stripe sandbox proof completed and verified.

## Objective

Prove exactly one pageCast Single Cast purchase through PayGate in Stripe sandbox/test mode:

1. pageCast sends only a non-commercial `item_ref`.
2. PayGate resolves amount, currency, lookup key, provider account, return URL, and entitlement scope from registry.
3. Stripe checkout is created only for an explicitly allowlisted sandbox item.
4. Verified Stripe webhook evidence projects the scoped item entitlement.
5. pageCast opens only the matching Premium Cast.
6. Live mode and broad item rollout remain blocked.

## Controlled item

- App: `pagecast`
- Item ref: `book:a2020000-0000-4000-8000-000000000001`
- Entitlement key: `pagecast.single_cast_unlock`
- Entitlement scope: `book_id=a2020000-0000-4000-8000-000000000001`
- Registry amount: USD 9.99 (`999` minor units)
- Stripe lookup key: `pagecast_book_a2020000_single_unlock`
- Environment: `test` only

## Safety gate

Item checkout is still blocked by default. It only opens for test mode when this server-side environment variable contains the exact app/item pair:

```ini
PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST=pagecast|book:a2020000-0000-4000-8000-000000000001
```

This gate does not enable live item checkout. A live request for the same `item_ref` still returns `ITEM_CHECKOUT_DISABLED`.

## Implemented PayGate changes

- Activated exactly one pageCast item in `registry/apps/pagecast/items.yaml` for sandbox proof.
- Added `PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST` runtime configuration.
- Extended PayGate checkout service so item checkout creation is allowed only when:
  - the item is active in registry;
  - the requested environment is `test`;
  - the exact `app_id|item_ref` pair is present in the allowlist.
- Added Stripe checkout metadata for item evidence:
  - `cph_item_ref`
  - `cph_item_entitlement_key`
  - `cph_item_entitlement_scope`
- Added operator/admin evidence fields for item checkout sessions and entitlement scopes.

## What pageCast is allowed to send

```json
{
  "app_id": "pagecast",
  "user_ref": "<supabase-user-uuid>",
  "item_ref": "book:a2020000-0000-4000-8000-000000000001",
  "return_context": "cast",
  "environment": "test"
}
```

pageCast must not send amount, currency, Stripe Price ID, provider account, provider customer, entitlement key, or arbitrary return URL.

## Stripe sandbox setup

In Stripe test/sandbox mode for provider account alias `nhl_global_solution`, a one-time Price exists with:

- Lookup key: `pagecast_book_a2020000_single_unlock`
- Amount: USD 9.99
- Mode/type: one-time payment
- Product name: pageCast Single Cast Unlock or equivalent

## Deployment setup

PayGate Vercel Production was configured with this exact sandbox allowlist value and redeployed:

```ini
PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST=pagecast|book:a2020000-0000-4000-8000-000000000001
```

No live item checkout flag was set. There is no live item checkout approval in Track 5I.

## Operator proof checklist

- [x] Confirm PayGate deploy includes Track 5I code and registry.
- [x] Confirm Stripe sandbox Price lookup key exists.
- [x] Confirm PayGate Vercel env has the exact allowlist value.
- [x] Open pageCast as an unpaid user.
- [x] Open `https://pagecast-nine.vercel.app/book/a2020000-0000-4000-8000-000000000001`.
- [x] Click Single Cast unlock.
- [x] Complete Stripe sandbox checkout.
- [x] Confirm PayGate admin summary for `app_id=pagecast&environment=test` shows the item checkout session with `item_ref`.
- [x] Confirm PayGate webhook evidence includes processed Stripe event(s).
- [x] Confirm PayGate customer entitlement includes `pagecast.single_cast_unlock` with matching scope.
- [x] Confirm the matching book opens.
- [x] Confirm an unpaid user remains locked unless Cast Pass, free, guest, or existing purchase rules apply.
- [x] Record evidence and keep this one sandbox item active for continued operator review.

## Accepted external proof evidence

- PayGate commit containing controlled item checkout path: `516e729`.
- pageCast deployed fixes through commit `9c700e9`.
- Stripe sandbox one-time payment succeeded for USD 9.99.
- Stripe sandbox PaymentIntent evidence: `pi_3UFx6NRgCMXjT1y61Jcu0APJ`.
- Stripe sandbox customer evidence: `cus_VGU3FpEifavCut`.
- pageCast paid-user book detail displays `Read Single Cast`.
- pageCast unpaid `reader2` store card displays `$9.99` / `Unlock Cast`.
- pageCast unpaid `reader2` book detail displays `Unlock Cast for $9.99` plus Cast Pass option.

Browser redirects did not grant access. Access was accepted only after PayGate projected verified item entitlement evidence from Stripe webhook processing.

## Verification already completed locally

`npm run check` passed:

- Registry validation: passed for 3 application package(s).
- TypeScript build: passed.
- Unit/registry/repository tests: 72 passed.

Key tests added/updated:

- Item checkout remains blocked when not allowlisted.
- Sandbox item checkout is created only when the exact item is allowlisted.
- Live item checkout remains blocked even when the sandbox allowlist contains the item.
- Verified item webhook evidence projects scoped item entitlement.
- Full refund/revocation evidence can revoke scoped item entitlement.
- pageCast active item registry loads the controlled sandbox item.

## Not authorized in this track

- No live Single Cast payment.
- No broad item catalog activation.
- No dynamic app-submitted amount or currency.
- No app-submitted Stripe Price ID.
- No entitlement grant from browser redirect.
- No refund execution.
