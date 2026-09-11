# Phase 7 Track 4H - pageCast Cast Pass Access Enforcement Evidence

Status: implemented; deployed browser verification pending.

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

PayGate:

- Registry manifest was updated to authorize Track 4H app file changes.
- `npm run validate:registry` passed after manifest update.

## Not completed

- Deployed browser verification pending after pageCast deployment for commit `acfef27`.
- Single Cast item/SKU purchase remains deferred.
- Store cards do not yet show `Included with Cast Pass`; that is optional UX polish.

## Deployment verification checklist

- [ ] Confirm pageCast deploys commit `acfef27`.
- [ ] Log in as the paid Cast Pass test user.
- [ ] Open a Premium Cast detail page.
- [ ] Confirm CTA says `Read with Cast Pass` or equivalent.
- [ ] Open the reader for the same Premium Cast.
- [ ] Log out or use an unpaid user.
- [ ] Confirm the same Premium Cast remains locked unless free/guest/purchased rules apply.