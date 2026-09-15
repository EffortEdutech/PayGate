# Phase 7 Track 5I - Controlled Single Cast Sandbox E2E Proof

Status: implementation prepared; external Stripe sandbox proof pending deployment/operator execution.

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

## Stripe sandbox setup required before external proof

In Stripe test/sandbox mode for provider account alias `nhl_global_solution`, confirm a one-time Price exists with:

- Lookup key: `pagecast_book_a2020000_single_unlock`
- Amount: USD 9.99
- Mode/type: one-time payment
- Product name: pageCast Single Cast Unlock or equivalent

## Deployment setup required before external proof

Set this PayGate Vercel Production env var and redeploy PayGate:

```ini
PAYGATE_ITEM_CHECKOUT_TEST_ALLOWLIST=pagecast|book:a2020000-0000-4000-8000-000000000001
```

Do not set any live item checkout flag. There is no live item checkout approval in Track 5I.

## Operator proof checklist

- [ ] Confirm PayGate deploy includes Track 5I code and registry.
- [ ] Confirm Stripe sandbox Price lookup key exists.
- [ ] Confirm PayGate Vercel env has the exact allowlist value.
- [ ] Open pageCast as an unpaid user.
- [ ] Open `https://pagecast-nine.vercel.app/book/a2020000-0000-4000-8000-000000000001`.
- [ ] Click Single Cast unlock.
- [ ] Complete Stripe sandbox checkout.
- [ ] Confirm PayGate admin summary for `app_id=pagecast&environment=test` shows the item checkout session with `item_ref`.
- [ ] Confirm PayGate webhook evidence includes processed Stripe event(s).
- [ ] Confirm PayGate customer entitlement includes `pagecast.single_cast_unlock` with matching scope.
- [ ] Confirm the matching book opens.
- [ ] Confirm another Premium Cast remains locked unless Cast Pass, free, guest, or existing purchase rules apply.
- [ ] Record evidence and decide whether to keep this one sandbox item active or return it to draft after proof.

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