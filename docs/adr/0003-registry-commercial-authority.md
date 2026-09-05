# ADR 0003: Registry is commercial configuration authority

## Status

Accepted — 2026-08-26

## Decision

Every integrated app owns a seven-file registry package. Apps submit logical plan keys. The Hub resolves prices, currencies, provider lookup keys, approved redirects, and entitlement bundles from validated registry content.

Provider object IDs are runtime mappings and must not be application-facing commercial identifiers.

