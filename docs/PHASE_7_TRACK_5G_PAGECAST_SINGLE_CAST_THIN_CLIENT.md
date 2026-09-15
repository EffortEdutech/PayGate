# Phase 7 Track 5G - pageCast Single Cast Thin Client

Status: complete; Single Cast checkout remains blocked by PayGate.

## Objective

Prepare pageCast to request a Single Cast checkout through PayGate using only a non-commercial item reference, while preserving PayGate's authority over price, currency, provider lookup, customer mapping, return URLs, and entitlements.

## Implemented

- Updated the pageCast PayGate client type so checkout can target either:
  - `plan_key` for Cast Pass; or
  - `item_ref` for Single Cast.
- Updated pageCast `/api/paygate/checkout` so:
  - empty body still starts Cast Pass checkout;
  - `{ "item_ref": "book:<uuid>" }` starts the prepared Single Cast PayGate path;
  - invalid item references are rejected before reaching PayGate;
  - PayGate disabled-gate responses are converted into operator/user-friendly Single Cast unavailable copy.
- Updated the Premium Cast detail CTA so paid Single Cast unlocks call `/api/paygate/checkout` instead of direct Stripe checkout.
- Kept free/starter Cast handling local.
- Kept Cast Pass checkout and Cast Pass access behavior unchanged.

## Authority boundary

pageCast sends only:

- `item_ref`
- the current authenticated app user's Supabase JWT through the server-side route

The pageCast UI/API does not send:

- amount;
- currency;
- Stripe Price ID;
- provider account;
- provider customer ID;
- entitlement key;
- arbitrary return URL.

PayGate still owns the registry lookup, provider lookup key, return URL allowlist, customer mapping, checkout creation, verified webhook processing, and entitlement projection.

## Expected runtime behavior now

Because PayGate item checkout remains disabled, a Premium Cast Single Cast unlock attempt should not create a Stripe checkout session yet.

Expected result:

- PayGate returns `ITEM_CHECKOUT_DISABLED` for active future item paths, or `ITEM_NOT_AVAILABLE` for draft/unavailable item entries.
- pageCast displays: `Single Cast checkout is being prepared in PayGate. Please use Cast Pass for now.`
- The reader source no longer references the legacy `/api/stripe/checkout` route for Premium Cast CTA flow; legacy route decommission remains a Track 5H hardening item because the current pageCast manifest lists it as verify-only, not modify.
- No Single Cast entitlement is granted.
- No Stripe item checkout is created.

## Verification

pageCast verification:

```powershell
npm run build --prefix apps/reader-app
```

Result: passed.

PayGate boundary verification remains covered by Tracks 5C-5F:

- `item_ref` accepted by contract but blocked behind disabled gate;
- provider lookup resolved from registry only;
- item persistence/evidence prepared;
- item-scoped projection accepts verified provider metadata only.

## Files changed in pageCast

- `apps/reader-app/src/lib/paymentHub/client.ts`
- `apps/reader-app/src/app/api/paygate/checkout/route.ts`
- `apps/reader-app/src/app/book/[id]/page.tsx`

## Next action

Proceed to Phase 7 Track 5H - pageCast access enforcement for matching book/bundle item entitlement.

Track 5H should read verified item entitlement evidence for the matching item scope, but it must continue to fail closed when evidence is absent and must not grant access from browser redirects.