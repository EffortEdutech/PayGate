# Phase 7 Track 4G - pageCast Cast Pass Access Enforcement Plan

Status: planned; implementation not started.

## Objective

Define how pageCast should enforce Cast Pass access using verified PayGate state before changing access-control code.

The goal is to let an active Cast Pass unlock app-wide premium Cast access while preserving PayGate authority boundaries and keeping Single Cast item-level unlock out of scope until a future item/SKU contract exists.

## Current proven state

Already completed:

- pageCast Cast Pass checkout starts through PayGate.
- Stripe sandbox payment succeeds.
- PayGate receives signed Stripe webhooks.
- PayGate projects active subscription and entitlement state.
- pageCast displays active Cast Pass state from PayGate via `/api/paygate/state`.

Current verified entitlement evidence:

- Subscription state: `active`
- Plan key: `cast_pass_monthly`
- Entitlement projection: `plan:cast_pass_monthly`
- Registry entitlements:
  - `pagecast.cast_pass`
  - `pagecast.premium_casts`

## Access policy decision

For the first implementation slice, active Cast Pass should unlock all current Premium Cast reading/listening access in the reader app.

Reason:

- The product promise says Cast Pass includes all Premium Casts.
- PayGate already projects app-wide Cast Pass entitlement from verified subscription evidence.
- Single Cast Unlock remains a separate future item-level purchase model.

## Explicit non-goals

Track 4G must not implement:

- per-book checkout migration;
- Single Cast item-level entitlement;
- dynamic book-specific Stripe Price creation;
- app-submitted amount/currency/provider price/customer/provider account/entitlement authority;
- browser redirect based access grants;
- live payment changes;
- refund/cancel downgrade logic beyond reading PayGate active/revoked state.

## Recommended access source

pageCast should call its own server-side route first, not PayGate directly from browser code.

Recommended route:

```txt
GET /api/paygate/state
```

This route already:

- authenticates the current Supabase user;
- forwards the user's Supabase JWT to PayGate;
- reads PayGate subscription and entitlement state;
- returns a small provider-neutral response to the browser.

## Proposed enforcement points

### 1. Book access API

Primary route:

```txt
apps/reader-app/src/app/api/books/[id]/access/route.ts
```

This should treat active Cast Pass as a valid access reason for non-free Premium Casts.

Suggested result when active:

```json
{
  "hasAccess": true,
  "reason": "cast_pass"
}
```

Existing access reasons such as free, guest, owned, or local subscription should remain intact until intentionally retired.

### 2. Book detail page

Primary file:

```txt
apps/reader-app/src/app/book/[id]/page.tsx
```

If `/api/books/[id]/access` returns `cast_pass`, the UI should show language like:

```txt
Unlocked by Cast Pass
```

It should not say the cast was individually purchased.

### 3. Reader page

Primary file:

```txt
apps/reader-app/src/app/reader/[id]/page.tsx
```

If server access reason is `cast_pass`, reading/listening should be allowed.

### 4. Store cards

Optional in the first implementation:

```txt
apps/reader-app/src/app/store/page.tsx
```

Store cards can later show `Included with Cast Pass`, but this is display polish and not required for the enforcement slice.

## State mapping

PayGate state should map to pageCast access as follows:

| PayGate state | Access result | Notes |
| --- | --- | --- |
| subscription active + plan `cast_pass_monthly` | allow Premium Cast access | primary path |
| entitlement `plan:cast_pass_monthly` active | allow Premium Cast access | current projection path |
| entitlement `pagecast.cast_pass` active | allow Premium Cast access | future richer projection path |
| entitlement `pagecast.premium_casts` active | allow Premium Cast access | future richer projection path |
| none / revoked / cancelled / past_due | no Cast Pass access | existing free/guest/owned rules may still allow access |
| PayGate unavailable | fail closed for Premium Cast access | do not unlock paid content from errors |

## Caching policy

For the first enforcement implementation:

- use `cache: no-store` for PayGate state reads;
- avoid persistent local entitlement cache until expiry/cancel/refund behavior is designed;
- keep the response small and provider-neutral.

A later optimization may add a short-lived server cache, but only if it respects revocation/refund windows.

## Safety requirements

Implementation must preserve these rules:

- pageCast never sends provider price IDs or provider customer IDs.
- pageCast never sends amount or currency.
- pageCast never chooses provider account.
- pageCast never grants access from `billing=success` redirect alone.
- PayGate verified webhook/reconciliation state remains the financial source of truth.
- Premium unlock fails closed if PayGate state is unavailable.

## Implementation checklist for next track

- [ ] Extend the pageCast manifest if new files need modification.
- [ ] Add a reusable server helper for reading Cast Pass state if needed.
- [ ] Update `/api/books/[id]/access` to allow `reason: cast_pass` when PayGate Cast Pass is active.
- [ ] Update book detail UI copy for Cast Pass access.
- [ ] Update reader route access handling if it depends on reason values.
- [ ] Run pageCast build/tests.
- [ ] Deploy pageCast.
- [ ] Verify paid test user can open a Premium Cast through Cast Pass.
- [ ] Verify unpaid user cannot open the same Premium Cast unless free/guest/owned rules apply.
- [ ] Record evidence in PayGate docs.

## Acceptance criteria

Track 4G planning is complete when:

- the access enforcement policy is documented;
- implementation scope and non-goals are explicit;
- the next track has a safe checklist;
- Single Cast remains blocked behind future item/SKU contract work.

## Next track

Proceed to Phase 7 Track 4H - implement pageCast Cast Pass access enforcement.