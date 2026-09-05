# ADR 0004: Environment and provider-account isolation

## Status

Accepted — 2026-08-26

## Decision

Test/sandbox and live data are isolated. Provider mappings, webhook secrets, event uniqueness, customer mappings, and idempotency scopes always include provider account and environment where applicable.

