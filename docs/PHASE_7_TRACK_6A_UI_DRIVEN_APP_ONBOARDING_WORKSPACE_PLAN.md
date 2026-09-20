# Phase 7 Track 6A - UI-driven App Onboarding Workspace Plan

Status: planned and ready for implementation after operator acceptance.

## Objective

Turn PayGate app onboarding from a document/manual-command workflow into a guided operator workspace inside `/admin`.

The workspace must help the operator prepare, validate, review, and export a new app onboarding package without giving the browser authority over secrets, live payments, registry mutation, Stripe mutation, or entitlement grants.

## Why this track exists

PayGate has proven AIntern and pageCast, but the onboarding workflow is still too manual:

- the operator must understand multiple docs;
- registry package details are still engineering-heavy;
- Stripe lookup keys and webhook setup are easy to confuse;
- current Draft Add App export is useful, but too shallow for real multi-app scale-out;
- PayGate product completion now requires UI-driven onboarding before freeze.

Track 6A is the planning/contract track for that workspace.

## Product rule

The UI guides and prepares. PayGate remains the authority.

The onboarding workspace may:

- collect draft app metadata;
- validate operator input;
- show known provider account aliases;
- generate a reviewable registry package proposal;
- generate setup checklists for Stripe, Supabase/JWT, webhooks, and sandbox proof;
- produce copyable/downloadable artifacts for engineering review.

The onboarding workspace must not:

- store or display provider secrets;
- create live payments;
- create refunds;
- mutate registry files directly in production;
- create Stripe Products or Prices directly;
- bypass `npm run validate:registry`;
- grant entitlements;
- allow arbitrary return URLs;
- allow app-submitted amount, currency, Stripe Price ID, provider customer, provider account, or entitlement authority.

## Proposed operator workflow

### 1. Start onboarding

Purpose: create a local draft workspace for a new app.

Fields:

- App ID
- Display name
- App owner/company
- Support/refund owner
- Intended environment: sandbox/test first
- App type: subscription, one-time plan, item/SKU, mixed
- Notes

Acceptance:

- App ID format is validated.
- Existing app ID conflict is detected.
- No live mode can be selected as the first onboarding proof.

### 2. Provider account selection

Purpose: map the app to a company-owned provider account alias.

Fields:

- Provider: Stripe for now
- Provider account alias, for example `nhl_global_solution`
- Company/account owner label
- Sandbox readiness status
- Live readiness status, display-only

Acceptance:

- Existing aliases are selectable.
- Unknown aliases are warned and require engineering review.
- Secret keys are never shown.
- Live-ready status does not authorize live use.

### 3. URLs and return contexts

Purpose: define safe allowlisted origins and return contexts.

Fields:

- Test origin
- Live origin
- Return contexts, for example `billing`, `cast`
- Notes for redirect destinations

Acceptance:

- URLs must be HTTPS except explicit localhost/dev exceptions if later allowed.
- Arbitrary caller return URLs are not accepted.
- Return contexts are explicit and reviewable.

### 4. Auth boundary

Purpose: define how PayGate will trust requests from the app.

Fields/checklist:

- Auth model: Supabase JWT, server-side proxy, or future provider
- JWKS URL
- Issuer
- Audience
- App claim/binding expectation
- User ref source

Acceptance:

- Browser-visible static PayGate tokens are marked unsuitable for production apps.
- User ref binding is required.
- Cross-app/cross-user risks are shown as checklist items.

### 5. Plans

Purpose: prepare PayGate-owned commercial plan definitions.

Fields per plan:

- Plan key
- Name
- Mode: payment or subscription
- Amount minor units
- Currency
- Billing interval, when subscription
- Test lookup key
- Live lookup key, optional/deferred
- Entitlement keys
- Status: draft, active, disabled

Acceptance:

- Amount uses integer minor units only.
- Currency is uppercase ISO.
- Stripe lookup keys are accepted; Stripe Price IDs are rejected.
- Entitlements must be app-scoped dotted keys.
- App cannot set provider price ID or provider account at runtime.

### 6. Items / SKU catalog

Purpose: support apps like pageCast where item-specific purchases exist.

Fields per item:

- Item ref, for example `book:<uuid>`
- Item name
- Item type: book, bundle, seat, credit, other
- Amount minor units
- Currency
- Test lookup key
- Live lookup key, optional/deferred
- Entitlement key
- Entitlement scope
- Status: draft, active, disabled

Acceptance:

- Item checkout remains disabled unless a separate controlled gate enables it.
- Live item checkout remains blocked unless explicitly approved.
- Entitlement scope must be specific and reviewable.

### 7. Stripe setup checklist

Purpose: turn registry definitions into operator instructions without calling Stripe.

Generated checklist:

- Product name to create
- Price mode/type
- Amount and currency
- Interval, if subscription
- Lookup key
- Test/live environment separation
- Provider account alias to use

Acceptance:

- Stripe setup guidance is copyable.
- The UI does not create Stripe objects in this track.
- Lookup key mismatch is flagged during evidence review.

### 8. Webhook setup checklist

Purpose: guide operator through provider webhook setup.

Generated checklist:

- Test webhook endpoint URL
- Live webhook endpoint URL, if live later
- Event types required
- Webhook secret env var name
- Redelivery guidance

Acceptance:

- Webhook secret value is never entered into the UI.
- Endpoint URLs are generated from provider account alias and environment.
- Live webhook readiness is display-only until live gate.

### 9. Sandbox proof checklist

Purpose: force every app through evidence before go-forward.

Checklist:

- Registry validation passes.
- PayGate deployment health is ready.
- App auth/JWT check passes.
- Checkout is created in sandbox/test.
- Stripe payment or subscription completes in sandbox/test.
- Signed webhook is processed.
- Entitlement state is projected.
- App displays provider-neutral paid/unpaid state correctly.
- Admin summary shows app/customer/checkout/webhook/entitlement evidence.
- Monitoring shows no critical alerts.

Acceptance:

- Browser redirect is never accepted as entitlement proof.
- Admin evidence is required before onboarding can be marked complete.

### 10. Export / handoff

Purpose: produce reviewable artifacts for engineering and operator records.

Artifacts:

- Registry package proposal JSON/YAML bundle.
- Environment variable checklist with names only, no values.
- Stripe setup checklist.
- Webhook setup checklist.
- Sandbox proof checklist.
- Go-forward/freeze decision note template.

Acceptance:

- Export is non-mutating.
- Export clearly says `draft` until validated and committed.
- `npm run validate:registry` remains mandatory before merge/deploy.

## Proposed admin UI structure

Navigation:

- Dashboard
- Apps
- App Workspace
- Add App / Onboarding
- Provider Accounts
- Webhooks
- Reconciliation
- Monitoring
- Settings
- Support / Debug

Onboarding workspace layout:

```text
Add App / Onboarding
├─ Intake
├─ Provider
├─ URLs
├─ Auth
├─ Plans
├─ Items
├─ Stripe setup
├─ Webhooks
├─ Sandbox proof
└─ Export / review
```

Each step should show:

- completion status;
- missing fields;
- blocking errors;
- warnings;
- next safe action;
- explicit non-authorized actions.

## Data model for draft export

The draft export should be provider-neutral and reviewable:

```json
{
  "status": "draft_preview_only",
  "app": {
    "app_id": "example_app",
    "name": "Example App",
    "owner": "Company/operator label",
    "provider_id": "stripe",
    "provider_account": "nhl_global_solution",
    "auth_model": "supabase_jwt"
  },
  "origins": {
    "test": "https://example-test.vercel.app/",
    "live": "https://example.com/"
  },
  "return_contexts": ["billing"],
  "plans": [],
  "items": [],
  "auth_checklist": [],
  "stripe_setup_checklist": [],
  "webhook_setup_checklist": [],
  "sandbox_proof_checklist": [],
  "required_next_steps": [
    "Operator review",
    "Registry package creation/review",
    "Stripe Product/Price lookup key setup",
    "Webhook setup",
    "npm run validate:registry",
    "npm run check",
    "Commit/deploy only after approval"
  ]
}
```

## Acceptance criteria for Track 6A

- [x] UI-driven onboarding objective is documented.
- [x] Workspace steps are defined.
- [x] Safety boundaries are defined.
- [x] Plan and item/SKU flows are both covered.
- [x] Auth, Stripe, webhook, sandbox proof, and export steps are covered.
- [x] Live payment, refund, live item checkout, registry mutation, and Stripe mutation remain blocked.
- [x] Next implementation track is defined.

## Next implementation track

Proceed to Phase 7 Track 6B - Build UI-driven onboarding workspace shell.

Track 6B should implement the multi-step admin workspace as a non-mutating UI first. It should not yet write registry files, call Stripe, deploy, or execute live actions.
