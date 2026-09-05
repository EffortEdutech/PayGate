# Payment Hub Engineering Constitution

These rules apply to every human or automated change in this repository.

1. The provider-neutral domain must not import provider SDKs or expose provider objects.
2. Applications submit `app_id`, `user_ref`, and `plan_key`; they never control authoritative amounts, currencies, provider price IDs, customer IDs, or entitlements.
3. Provider secrets exist only in server-side secret storage and must never be committed or returned to applications.
4. Checkout and portal return destinations are resolved from registry allowlists, not arbitrary caller URLs.
5. Financially derived entitlement mutations require a verified provider event or explicit reconciliation result. Browser redirects never grant access.
6. Webhook signatures are verified against raw request bytes before an event enters the trusted inbox.
7. Webhook and mutation processing must be idempotent and safe under retries, duplicates, and out-of-order delivery.
8. Monetary values use integer minor units plus an uppercase ISO currency code. Never use floating point.
9. Applications consume stable Hub states and entitlements, never raw provider statuses.
10. Registry changes require `npm run validate:registry`. Schema and semantic validation must both pass.
11. Do not modify an application repository beyond paths authorized by its `files.manifest.yaml`.
12. Test/sandbox and live environments are isolated in credentials, mappings, webhooks, data, and idempotency scope.
13. Adding provider-specific capabilities must extend an adapter capability declaration without contaminating core contracts.
14. No live credential use, catalog mutation, deployment, or production transaction is authorized merely by editing this repository.

