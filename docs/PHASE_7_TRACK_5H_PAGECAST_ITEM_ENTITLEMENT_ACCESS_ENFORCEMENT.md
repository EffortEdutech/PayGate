# Phase 7 Track 5H - pageCast Item Entitlement Access Enforcement

Status: complete; item payment activation remains disabled.

## Objective

Allow pageCast to unlock a specific Premium Cast only when PayGate reports verified item-scoped entitlement evidence matching that cast.

This track is access-read behavior only. It does not activate Single Cast checkout, create Stripe item sessions, grant access from redirects, or mutate entitlements from pageCast.

## Implemented

- Extended the pageCast PayGate entitlement type to include optional `scope`.
- Updated pageCast `/api/books/[id]/access` so it checks PayGate state in this order:
  1. guest access;
  2. authenticated free cast;
  3. existing Supabase purchase record;
  4. existing Supabase subscription record;
  5. verified PayGate Cast Pass entitlement/state;
  6. verified PayGate Single Cast item entitlement matching the current book.
- Added strict Single Cast entitlement matching:
  - entitlement key must be `pagecast.single_cast_unlock`;
  - entitlement state must be `active`;
  - entitlement scope must match the current book using `scope.bookId` or contain the book in `scope.bookIds`.
- Updated the book detail UI so verified item entitlement displays as Single Cast access, separate from Cast Pass.

## Authority boundary

pageCast does not grant item access from:

- checkout redirect query params;
- browser-only success pages;
- app-submitted prices;
- app-submitted entitlement keys;
- app-submitted provider metadata.

Access depends on PayGate state returned from `/v1/entitlements`, which is projected from verified provider evidence or explicit reconciliation only.

## Expected behavior

For a user with no Cast Pass and no matching item entitlement:

- Premium Cast remains locked.
- CTA remains Single Cast unlock / Cast Pass path.

For a user with active Cast Pass:

- Any Premium Cast can open with Cast Pass.

For a user with active `pagecast.single_cast_unlock` and matching `scope.bookId` or `scope.bookIds`:

- Only the matching Premium Cast opens.
- Other Premium Casts remain locked unless another access rule applies.

## Verification

pageCast verification:

```powershell
npm run build --prefix apps/reader-app
```

Result: passed.

## Files changed in pageCast

- `apps/reader-app/src/lib/paymentHub/client.ts`
- `apps/reader-app/src/app/api/books/[id]/access/route.ts`
- `apps/reader-app/src/app/book/[id]/page.tsx`

## Still deferred

- Single Cast checkout activation.
- Single Cast sandbox E2E payment proof.
- Legacy pageCast `/api/stripe/checkout` route decommission/protection; current manifest lists it as verify-only.
- pageCast live payments.

## Next action

Proceed to Phase 7 Track 5I - sandbox E2E proof for one controlled Single Cast only after operator approves enabling item checkout for a controlled sandbox item.