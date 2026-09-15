# Phase 7 Track 4H - pageCast Cast Pass Access Enforcement Evidence

Status: implemented and deployed browser verification accepted.

## Objective

Make pageCast's actual book access check use verified PayGate Cast Pass state for Premium Cast access.

This implements the Track 4G plan without enabling Single Cast item-level checkout.

## pageCast implementation

pageCast commit: `acfef27` (`Enforce Cast Pass access through PayGate`)

Changed files:

- `apps/reader-app/src/app/api/books/[id]/access/route.ts`
- `apps/reader-app/src/app/book/[id]/page.tsx`

## Access behavior

The book access API now preserves existing access paths:

- guest access;
- authenticated free casts;
- existing per-book purchases;
- existing local subscription records.

For locked Premium Casts, it now reads PayGate state server-side using the current Supabase user session and allows access only when PayGate reports active Cast Pass evidence.

Successful Cast Pass response:

```json
{
  "hasAccess": true,
  "reason": "cast_pass"
}
```

If PayGate is unavailable or does not report active Cast Pass, premium access fails closed and returns the existing locked result.

## UI behavior

The book detail page now displays Cast Pass-specific copy when access reason is `cast_pass`:

- `Read with Cast Pass`
- `Unlocked by Cast Pass - enjoy the full Journey`
- `Cast Pass`
- `Open with Cast Pass`

## Boundaries preserved

pageCast still does not control:

- amount;
- currency;
- provider price ID;
- provider account;
- provider customer ID;
- entitlement keys;
- webhook processing;
- subscription authority.

Browser redirects still do not grant access.

## Verification

pageCast:

- `npm run build` passed in `apps/reader-app`.
- Build output includes `/api/books/[id]/access` and existing PayGate routes.
- Local and deployed pricing pages both showed active PayGate Cast Pass state for the paid test user after local PayGate env correction.
- Premium Cast verification URL:
  - `https://pagecast-nine.vercel.app/book/a2020000-0000-4000-8000-000000000001`
- Unpaid state evidence:
  - CTA: `Unlock Cast for $9.99`
  - Secondary action: `Get Cast Pass`
- Paid Cast Pass state evidence:
  - CTA: `Read with Cast Pass`
  - Reader target: `https://pagecast-nine.vercel.app/reader/a2020000-0000-4000-8000-000000000001`

PayGate:

- Registry manifest was updated to authorize Track 4H app file changes.
- `npm run validate:registry` passed after manifest update.

## Not completed

- Single Cast item/SKU purchase remains deferred.
- Store cards do not yet show `Included with Cast Pass`; that is optional UX polish.

## Deployment verification checklist

- [x] Confirm pageCast deploys commit `acfef27`.
- [x] Log in as the paid Cast Pass test user.
- [x] Open a Premium Cast detail page.
- [x] Confirm CTA says `Read with Cast Pass` or equivalent.
- [x] Open the reader for the same Premium Cast.
- [x] Log out or use an unpaid user.
- [x] Confirm the same Premium Cast remains locked unless free/guest/purchased rules apply.