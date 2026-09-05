import type { QueryResult, QueryResultRow } from "pg";
import type { IdempotencyBeginResult, IdempotencyLedger, IdempotencyRecord, IdempotencyScope } from "../security/idempotency.js";
import { hashIdempotentRequest, IdempotencyConflictError } from "../security/idempotency.js";
import type { PgQueryClient } from "./postgres-repository.js";

export class PostgresIdempotencyLedger implements IdempotencyLedger {
  constructor(readonly db: PgQueryClient, readonly ttlMs = 86_400_000) {}

  async begin(scope: IdempotencyScope, requestBody: unknown): Promise<IdempotencyBeginResult> {
    const applicationId = await this.applicationId(scope.appId);
    const requestHash = hashIdempotentRequest(requestBody);
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const inserted = await this.db.query<DbIdempotencyRow>(
      `INSERT INTO api_idempotency (application_id, operation, idempotency_key, request_sha256, status, expires_at)
       VALUES ($1, $2, $3, $4, 'processing', $5)
       ON CONFLICT (application_id, operation, idempotency_key) DO NOTHING
       RETURNING operation, idempotency_key, request_sha256, status, response_status, response_body`,
      [applicationId, scope.operation, scope.key, requestHash, expiresAt],
    );
    const row = inserted.rows[0] ?? await this.readExisting(applicationId, scope);
    if (row.request_sha256 !== requestHash) throw new IdempotencyConflictError();
    const record = toRecord(scope, row);
    return { kind: record.state === "completed" ? "replay" : "started", record };
  }

  async complete(scope: IdempotencyScope, responseStatus: number, responseBody: unknown): Promise<void> {
    const applicationId = await this.applicationId(scope.appId);
    await this.db.query(
      `UPDATE api_idempotency
       SET status = 'completed', response_status = $4, response_body = $5::jsonb
       WHERE application_id = $1 AND operation = $2 AND idempotency_key = $3`,
      [applicationId, scope.operation, scope.key, responseStatus, JSON.stringify(responseBody)],
    );
  }

  async fail(scope: IdempotencyScope): Promise<void> {
    const applicationId = await this.applicationId(scope.appId);
    await this.db.query(
      `UPDATE api_idempotency SET status = 'failed'
       WHERE application_id = $1 AND operation = $2 AND idempotency_key = $3 AND status = 'processing'`,
      [applicationId, scope.operation, scope.key],
    );
  }

  private async applicationId(appId: string): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO payment_applications (app_id, registry_version, status)
       VALUES ($1, 'runtime', 'active')
       ON CONFLICT (app_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [appId],
    );
    return requireRow(result, "payment_applications").id;
  }

  private async readExisting(applicationId: string, scope: IdempotencyScope): Promise<DbIdempotencyRow> {
    const result = await this.db.query<DbIdempotencyRow>(
      `SELECT operation, idempotency_key, request_sha256, status, response_status, response_body
       FROM api_idempotency
       WHERE application_id = $1 AND operation = $2 AND idempotency_key = $3`,
      [applicationId, scope.operation, scope.key],
    );
    return requireRow(result, "api_idempotency");
  }
}

interface DbIdempotencyRow extends QueryResultRow {
  readonly operation: string;
  readonly idempotency_key: string;
  readonly request_sha256: string;
  readonly status: "processing" | "completed" | "failed";
  readonly response_status: number | null;
  readonly response_body: unknown;
}

function toRecord(scope: IdempotencyScope, row: DbIdempotencyRow): IdempotencyRecord {
  return {
    ...scope,
    requestHash: row.request_sha256,
    state: row.status,
    ...(row.response_status ? { responseStatus: row.response_status } : {}),
    ...(row.response_body !== null ? { responseBody: row.response_body } : {}),
  };
}

function requireRow<R extends QueryResultRow>(result: QueryResult<R>, table: string): R {
  const row = result.rows[0];
  if (!row) throw new Error(`${table} did not return a row`);
  return row;
}
