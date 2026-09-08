# Phase 7 Track 1F - Operator Console UX Blueprint

Status: accepted; Track 1H operator identity UX implemented locally pending deployment review.
Date: 2026-09-09.
Parent sprint: `docs/PHASE_7_MULTI_APP_SCALE_OUT_SPRINT_PLAN.md`.
Related plan: `docs/PHASE_7_TRACK_1_OPERATOR_CONSOLE_UX_PLAN.md`.

## Why This Blueprint Exists

The current `/admin` page proved useful backend data access, but it is not yet a proper operator console. It mixes dashboard, app workspace, evidence viewer, onboarding checklist, app selector, and support JSON in one long page. That creates cognitive load and makes the operator ask: where do I start, what do I read, and what is the workflow?

Track 1F freezes the intended product shape before more UI code is added.

## Product UX Objective

PayGate Operator Console must feel like a real control room for many apps, not a developer diagnostics page.

The operator should be able to:

- sign in once;
- see a clean dashboard;
- know whether PayGate needs attention;
- choose an app from a clear app directory;
- work inside one selected app workspace;
- review plans, provider account, URLs, auth, customers, entitlements, webhooks, reconciliation, and evidence;
- start a guided Add App flow later;
- avoid raw JSON unless deliberately opening Support/Debug;
- never see or handle provider secrets in the UI.

## Information Architecture

```text
PayGate Operator Console
├─ Sidebar
│  ├─ Dashboard
│  ├─ Apps
│  │  ├─ All Apps
│  │  └─ Selected App Workspace
│  ├─ Provider Accounts
│  ├─ Webhooks
│  ├─ Reconciliation
│  ├─ Settings
│  ├─ + Add App
│  └─ Operator Area
│     ├─ Session status
│     └─ Logout
└─ Main Area
   ├─ Dashboard View
   ├─ Apps Directory View
   ├─ App Workspace View
   ├─ Provider Accounts View
   ├─ Webhooks View
   ├─ Reconciliation View
   ├─ Settings View
   └─ Add App Wizard View, future
```

## Core Layout

```text
┌───────────────────────┬──────────────────────────────────────────────┐
│ Sidebar               │ Main Area                                    │
│                       │                                              │
│ PayGate               │ View title + status                          │
│ Dashboard             │                                              │
│ Apps                  │ Current view content                         │
│ Provider Accounts     │                                              │
│ Webhooks              │ Dashboard OR workspace OR settings           │
│ Reconciliation        │                                              │
│ Settings              │                                              │
│ + Add App             │                                              │
│                       │                                              │
│ Operator              │                                              │
│ Signed in             │                                              │
│ Logout                │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

## Login / Session Workflow

Login should be a simple gate, not a permanent control panel element.

```text
Open /admin
-> if no valid session, show centered login card
-> operator enters login token once
-> PayGate creates HttpOnly secure session cookie
-> console opens Dashboard
-> sidebar shows Operator / Signed in / Logout at bottom
```

Rules:

- Do not show the token field after login.
- Do not place token beside app selection.
- Do not make the operator remember or paste the token repeatedly.
- Keep Bearer-token API support for PowerShell diagnostics, but not as the browser UX.

## Dashboard View

Purpose: answer `Is PayGate okay, and what needs attention?`

Dashboard must show only global operational information.

Recommended sections:

1. Health banner
   - `Healthy`, `Needs review`, or `Critical`.
   - One sentence explaining why.
   - One primary next action.

2. KPI row
   - Apps configured.
   - Provider accounts configured.
   - Webhook failures/retries/dead letters.
   - Reconciliation warnings/failures.

3. Attention queue
   - Apps needing setup.
   - Missing lookup keys.
   - Webhook failures.
   - Reconciliation warnings.
   - Live-mode gates not ready.

4. Recent activity
   - Latest checkout event.
   - Latest webhook event.
   - Latest reconciliation run.

Dashboard must not show:

- full checkout session list;
- full customer list;
- full raw JSON;
- app editing forms;
- provider secrets;
- refund execution actions.

## Apps Directory View

Purpose: answer `Which apps are connected, and which one do I want to work on?`

Recommended layout:

```text
Apps
├─ Top controls
│  ├─ Search apps
│  ├─ Environment filter
│  └─ + Add App, disabled until wizard is ready
└─ App cards/table
   ├─ App name
   ├─ App ID
   ├─ Provider account
   ├─ Plans count
   ├─ Test readiness
   ├─ Live readiness
   ├─ Webhook health
   └─ Last activity
```

Behavior:

- App list is populated from PayGate registry after login.
- Search filters loaded apps only.
- Clicking an app opens App Workspace.
- App Directory is not the place to edit plans or secrets.

## App Workspace View

Purpose: answer `What is the full payment setup and payment state for this app?`

Recommended app workspace navigation:

```text
AIntern Workspace
├─ Overview
├─ Plans & Prices
├─ Provider Account
├─ URLs & Return Contexts
├─ Auth Boundary
├─ Customers & Entitlements
├─ Webhooks
├─ Reconciliation
├─ Evidence
└─ Settings, view-only until edit wizard
```

### App Workspace - Overview

Shows:

- app name and app ID;
- provider account alias;
- environment readiness;
- current warnings;
- next safe action.

### Plans & Prices

Shows:

- plan key;
- display name;
- mode: one-time, subscription, usage, mixed later;
- integer minor amount and formatted amount;
- currency;
- sandbox lookup configured;
- live lookup configured;
- entitlement list.

Must not allow apps/operators to bypass registry validation.

### Provider Account

Shows:

- provider ID;
- provider account alias;
- linked apps;
- sandbox/live readiness;
- webhook endpoint presence;
- isolation status.

Must not show secret key or webhook secret values.

### URLs & Return Contexts

Shows:

- test origin;
- live origin;
- allowed return contexts;
- success/cancel/portal paths.

Must explain that caller-provided arbitrary URLs are not accepted.

### Auth Boundary

Shows:

- auth method: Supabase JWKS/JWT, backend proxy, or server token;
- issuer/audience/app binding status;
- user_ref binding expectation.

Must not show JWT secrets or access tokens.

### Customers & Entitlements

Shows:

- searchable user_ref;
- provider customer mapping;
- PayGate state;
- entitlement keys;
- source evidence for entitlement mutation.

Must explain redirects do not grant entitlements.

### Webhooks

Shows:

- endpoint URL;
- latest event;
- failed/retry/dead counts;
- event status and app/user mapping.

Must explain only signed POST webhooks are trusted.

### Reconciliation

Shows:

- latest reconciliation run;
- status;
- classification;
- app/user/provider/environment;
- explanation for expected statuses such as one-time payment `no_provider_subscription`.

Any run action must remain idempotent and explicitly scoped.

### Evidence

Shows:

- linked evidence docs;
- checkout proof;
- webhook proof;
- portal proof;
- reconciliation proof;
- live pilot status;
- refund deferred status.

## Provider Accounts View

Purpose: answer `Which company/provider account handles which apps?`

Shows:

- provider account aliases;
- linked apps;
- sandbox/live credential readiness, without values;
- webhook endpoint status;
- isolation test status;
- warning if a generic alias such as `primary` is used in live mode.

## Webhooks View

Purpose: answer `Are provider events arriving and processing safely?`

Shows:

- filters: app, provider account, environment, status;
- latest events;
- failed/retry/dead counts;
- processed timestamps;
- safe redelivery guidance.

## Reconciliation View

Purpose: answer `Does PayGate agree with provider evidence?`

Shows:

- filters: app, user_ref, provider account, environment, status;
- latest runs;
- classifications;
- recommended operator actions.

## Settings View

Purpose: answer `Is deployment/runtime configuration ready?`

Shows safe diagnostics only:

- deployment URL;
- environment;
- database reachable;
- auth issuer/audience presence;
- JWKS host;
- CORS origin host;
- configured sandbox provider accounts;
- configured live provider accounts;
- live checkout/portal/reconciliation flags.

Must not show raw secrets.

## Add App Wizard, Future Track

Purpose: safely create app setup as a draft.

Flow:

```text
+ Add App
-> App Identity
-> Provider Account
-> URLs / Return Contexts
-> Plans & Prices
-> Entitlements
-> Auth Boundary
-> Stripe Setup Checklist
-> Preview Registry Package
-> Validate
-> Operator Approval
-> Apply/Commit/Deploy, future controlled step
```

Track 1F does not implement this wizard. It only defines the entry point and expected flow.

## UX Rules to Lock

- Sidebar controls navigation.
- Dashboard and app workspace are separate views.
- Login is a gateway screen, not a permanent top form.
- App selection belongs inside Apps/Workspace, not beside login token.
- Raw JSON is hidden inside Support/Debug.
- Warnings must include plain-language meaning and next action.
- The default view after login is Dashboard.
- If multiple apps exist, do not auto-open a random app workspace.
- If one app exists, dashboard may recommend opening that app, but should not hide Dashboard.
- Every screen must preserve sandbox/live separation.
- Every screen must preserve provider account isolation.
- No screen displays secrets.

## Implementation Plan After Acceptance

### Track 1G - Rebuild Admin Shell Around Blueprint

- Replace mixed long page with sidebar app shell.
- Add login screen state.
- Add dashboard route/view state.
- Add apps directory route/view state.
- Add selected app workspace route/view state.
- Keep data read-only.

### Track 1H - Operator Identity UX

- Clarify that the operator login credential belongs to PayGate.
- Clarify that AIntern/app users use app JWTs, not the PayGate operator token.
- Clarify that Stripe account identity is represented by provider account aliases and server-side secrets.
- Keep named operator accounts, roles, and audit trail as the next proper-auth target.

### Track 1I - Workspace Tabs

- Add app workspace tabs: Overview, Plans, Provider, URLs, Auth, Customers, Webhooks, Reconciliation, Evidence.
- Keep edit buttons disabled or labelled future until draft workflow exists.

### Track 1J - Draft Add/Edit App Wizard

- Add guided forms.
- Generate draft registry package preview.
- Validate before apply.
- No direct live mutation.

## Acceptance Checklist

- [x] Dashboard and workspace separated in blueprint.
- [x] Sidebar navigation defined.
- [x] Operator login/logout placement defined.
- [x] App directory and app workspace responsibilities defined.
- [x] Add App wizard entry point defined as future draft workflow.
- [x] Screen-level safety rules documented.
- [x] Raw/debug JSON moved out of main workflow.
- [x] Operator accepted blueprint on 2026-09-09.
- [x] Track 1G rebuilt `/admin` around the accepted dashboard/sidebar/workspace shell.
- [x] Admin shell remains read-only; Add App/edit/refund/live mutation actions remain future controlled tracks.

## Operator Acceptance Gate

Blueprint accepted by operator on 2026-09-09. Track 1G rebuild may proceed only inside this accepted shape: login gate, sidebar, Dashboard, Apps Directory, App Workspace, Provider Accounts, Webhooks, Reconciliation, Settings, and Support/Debug.
## Track 1G Implementation Evidence

Date: 2026-09-09

Implemented in `api/index.ts`:

- Login gate first: operator token is entered only on the login screen and exchanged for the existing protected admin session cookie.
- Dashboard after login: high-level health, alerts, app/customer/webhook/reconciliation counts, and recent activity.
- Sidebar navigation: Dashboard, Apps Directory, App Workspace, Provider Accounts, Webhooks, Reconciliation, Settings, Support/Debug.
- Apps Directory: searchable app cards; selecting an app opens the App Workspace.
- App Workspace: one app at a time with provider mapping, return origins, plans, customer/entitlement evidence, webhook evidence, and reconciliation evidence.
- Provider Accounts: grouped app-to-provider-account mapping without exposing secrets.
- Support/Debug: raw safe JSON is isolated away from the normal workflow.
- Add App remains visible but disabled as a planned draft workflow.

Validation:

- `npm run check` passed: registry validation, TypeScript build, and 58/58 tests.
- Admin shell unit test updated to lock the new blueprint labels and confirm the operator token is not embedded in HTML.

Safety boundary:

Track 1G is a read-only UX rebuild. It does not authorize registry edits, secret edits, refunds, live payment actions, or provider-side mutations.

## Track 1H Implementation Evidence

Date: 2026-09-09

Implemented in `api/index.ts`:

- Login field now says `PayGate operator access token`.
- Login copy states that the credential belongs to PayGate, not AIntern, not Stripe, and not an app user account.
- Login help explains that `OPERATOR_DIAGNOSTICS_TOKEN` is the temporary PayGate admin/bootstrap token in Vercel.
- Settings view separates three identities: PayGate Operator Identity, App User Identity, and Provider Identity.
- Future target is documented as named operator accounts, roles, and audit trail.

Validation:

- Admin shell unit test now locks the identity UX wording and still confirms the real operator token value is not embedded in HTML.

Safety boundary:

Track 1H does not change authentication authority yet. It clarifies the UX and documentation while preserving the existing protected session-cookie flow.

## Track 1I Implementation Evidence

Date: 2026-09-09

Implemented in `api/index.ts`:

- App Workspace now uses tabs instead of one long mixed panel.
- Tabs: Overview, Plans, URLs, Customers, Webhooks, Reconciliation, Evidence.
- Workspace top summary shows plans, customers, webhooks, and reconciliation counts.
- Plan cards show PayGate-owned plan key, amount, mode, status, lookup configuration, and entitlement list.
- URL cards restate the registry allowlist rule and browser redirect non-authority rule.
- Evidence cards isolate checkout sessions from webhook/reconciliation proof.

Validation:

- Admin shell unit test now locks workspace tab labels and card headings.

Safety boundary:

Track 1I is still read-only. It improves operator comprehension but does not add edit, refund, registry mutation, or live-operation buttons.
