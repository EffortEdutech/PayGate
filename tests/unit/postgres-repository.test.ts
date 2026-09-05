import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryResult, QueryResultRow } from "pg";
import type { VerifiedProviderEvent } from "@payment-hub/contracts";
import { hashIdempotentRequest, PostgresIdempotencyLedger, PostgresPaymentRepository, type PgQueryClient, type PgTransactionClient, type PgTransactionalClient } from "../../payment-hub/src/index.js";

class RecordingQueryClient implements PgQueryClient {
  readonly calls: Array<{ readonly text: string; readonly values: readonly unknown[] }> = [];

  async query<R extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
    this.calls.push({ text, values });
    if (text.includes("RETURNING id")) return result([{ id: "00000000-0000-0000-0000-000000000001" } as R]);
    if (text.includes("provider_customer_ref")) return result([{ provider_customer_ref: "cus_test_123" } as R]);
    if (text.includes("SELECT sp.state")) return result([{ state: "active", plan_key: "growth_monthly", current_period_end: null } as R]);
    if (text.includes("SELECT DISTINCT ON")) return result([{ entitlement_key: "plan:growth_monthly", status: "active", effective_until: null } as R]);
    return result([]);
  }
}

class TransactionRecordingClient extends RecordingQueryClient implements PgTransactionClient {
  released = false;
  release(): void { this.released = true; }
}

class RecordingPool extends RecordingQueryClient implements PgTransactionalClient {
  readonly transactionClient = new TransactionRecordingClient();
  async connect(): Promise<PgTransactionClient> { return this.transactionClient; }
}

class IdempotencyQueryClient extends RecordingQueryClient {
  storedHash?: string;
  completedBody: unknown = null;
  completedStatus: number | null = null;

  override async query<R extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
    this.calls.push({ text, values });
    if (text.includes("payment_applications") && text.includes("RETURNING id")) return result([{ id: "00000000-0000-0000-0000-000000000001" } as R]);
    if (text.includes("INSERT INTO api_idempotency")) {
      const requestHash = values[3] as string;
      if (!this.storedHash) {
        this.storedHash = requestHash;
        return result([{ operation: values[1], idempotency_key: values[2], request_sha256: requestHash, status: "processing", response_status: null, response_body: null } as R]);
      }
      return result([]);
    }
    if (text.includes("SELECT operation, idempotency_key")) {
      return result([{ operation: values[1], idempotency_key: values[2], request_sha256: this.storedHash, status: this.completedStatus ? "completed" : "processing", response_status: this.completedStatus, response_body: this.completedBody } as R]);
    }
    if (text.includes("UPDATE api_idempotency") && text.includes("completed")) {
      this.completedStatus = values[3] as number;
      this.completedBody = JSON.parse(values[4] as string) as unknown;
    }
    return result([]);
  }
}

function result<R extends QueryResultRow>(rows: R[]): QueryResult<R> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}

test("Postgres repository persists checkout intent without provider authority fields from apps", async () => {
  const db = new RecordingQueryClient();
  const repository = new PostgresPaymentRepository(db);
  await repository.saveCheckoutSession({
    appId: "app_test",
    userRef: "user_1",
    planKey: "growth_monthly",
    providerId: "stripe",
    providerAccount: "primary",
    environment: "test",
    checkoutSessionId: "cs_test_123",
    redirectUrl: new URL("https://checkout.stripe.com/c/test"),
    status: "open",
    expiresAt: new Date("2026-08-26T12:00:00.000Z"),
  });
  assert.ok(db.calls.some((call) => call.text.includes("INSERT INTO checkout_sessions")));
  const checkoutCall = db.calls.find((call) => call.text.includes("INSERT INTO checkout_sessions"));
  assert.deepEqual(checkoutCall?.values.slice(2, 7), ["stripe", "primary", "test", "growth_monthly", "cs_test_123"]);
});

test("Postgres repository deduplicates webhook events by provider identity", async () => {
  const db = new RecordingQueryClient();
  const repository = new PostgresPaymentRepository(db);
  const event: VerifiedProviderEvent = {
    providerId: "stripe",
    providerAccount: "primary",
    environment: "test",
    providerEventId: "evt_test_123",
    providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"),
    eventType: "checkout.completed",
    payload: { rawType: "checkout.session.completed", evidence: { id: "evt_test_123" } },
  };
  assert.equal(await repository.insertWebhookEvent(event, "abc"), "inserted");
  const webhookCall = db.calls.find((call) => call.text.includes("INSERT INTO webhook_inbox"));
  assert.deepEqual(webhookCall?.values.slice(0, 4), ["stripe", "primary", "test", "evt_test_123"]);
});

test("Postgres repository projects verified events into subscription and entitlement state", async () => {
  const db = new RecordingQueryClient();
  const repository = new PostgresPaymentRepository(db);
  await repository.applyVerifiedEvent(verifiedEvent());
  assert.ok(db.calls.some((call) => call.text.includes("INSERT INTO subscription_projection")));
  assert.ok(db.calls.some((call) => call.text.includes("INSERT INTO entitlement_grants")));
  assert.ok(db.calls.some((call) => call.text.includes("UPDATE webhook_inbox SET status = 'processed'")));
});

test("Postgres repository wraps verified event projection in a transaction when available", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresPaymentRepository(pool);
  await repository.applyVerifiedEvent(verifiedEvent());
  assert.equal(pool.transactionClient.calls[0]?.text, "BEGIN");
  assert.ok(pool.transactionClient.calls.some((call) => call.text === "COMMIT"));
  assert.equal(pool.transactionClient.released, true);
});

test("Postgres repository returns provider-neutral current projections", async () => {
  const repository = new PostgresPaymentRepository(new RecordingQueryClient());
  assert.deepEqual(await repository.currentSubscription("app_test", "user_1"), { appId: "app_test", userRef: "user_1", state: "active", planKey: "growth_monthly" });
  assert.deepEqual(await repository.currentEntitlements("app_test", "user_1"), { appId: "app_test", userRef: "user_1", entitlements: [{ key: "plan:growth_monthly", state: "active" }] });
});

test("Postgres idempotency ledger persists completion and replays the stored response", async () => {
  const db = new IdempotencyQueryClient();
  const ledger = new PostgresIdempotencyLedger(db);
  const scope = { appId: "app_test", operation: "checkout.create", key: "idem_1" };
  assert.equal((await ledger.begin(scope, { app_id: "app_test" })).kind, "started");
  await ledger.complete(scope, 200, { checkout_session_id: "cs_test_123" });
  const replay = await ledger.begin(scope, { app_id: "app_test" });
  assert.equal(replay.kind, "replay");
  assert.deepEqual(replay.record.responseBody, { checkout_session_id: "cs_test_123" });
});

test("Postgres idempotency ledger rejects same key with a different request hash", async () => {
  const db = new IdempotencyQueryClient();
  const ledger = new PostgresIdempotencyLedger(db);
  const scope = { appId: "app_test", operation: "checkout.create", key: "idem_1" };
  await ledger.begin(scope, { app_id: "app_test" });
  await assert.rejects(() => ledger.begin(scope, { app_id: "app_test", changed: true }));
  assert.notEqual(hashIdempotentRequest({ app_id: "app_test" }), hashIdempotentRequest({ app_id: "app_test", changed: true }));
});

function verifiedEvent(): VerifiedProviderEvent {
  return {
    providerId: "stripe",
    providerAccount: "primary",
    environment: "test",
    providerEventId: "evt_test_123",
    providerCreatedAt: new Date("2026-08-26T12:00:00.000Z"),
    eventType: "checkout.completed",
    payload: { appId: "app_test", userRef: "user_1", planKey: "growth_monthly", providerCustomerRef: "cus_test_123", providerSubscriptionRef: "sub_test_123", subscriptionState: "active", rawType: "checkout.session.completed", evidence: { id: "cs_test_123" } },
  };
}

