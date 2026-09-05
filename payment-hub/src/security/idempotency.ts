import { createHash } from "node:crypto";

export interface IdempotencyScope {
  readonly appId: string;
  readonly operation: string;
  readonly key: string;
}

export interface IdempotencyRecord extends IdempotencyScope {
  readonly requestHash: string;
  readonly state: "processing" | "completed" | "failed";
  readonly responseStatus?: number;
  readonly responseBody?: unknown;
}

export interface IdempotencyBeginResult {
  readonly kind: "started" | "replay";
  readonly record: IdempotencyRecord;
}

export interface IdempotencyLedger {
  begin(scope: IdempotencyScope, requestBody: unknown): Promise<IdempotencyBeginResult>;
  complete(scope: IdempotencyScope, responseStatus: number, responseBody: unknown): Promise<void>;
  fail(scope: IdempotencyScope): Promise<void>;
}

export function hashIdempotentRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export function assertMatchingReplay(record: IdempotencyRecord, requestHash: string): void {
  if (record.requestHash !== requestHash) throw new IdempotencyConflictError();
}

export class InMemoryIdempotencyLedger implements IdempotencyLedger {
  readonly #records = new Map<string, IdempotencyRecord>();

  async begin(scope: IdempotencyScope, requestBody: unknown): Promise<IdempotencyBeginResult> {
    const requestHash = hashIdempotentRequest(requestBody);
    const key = scopeKey(scope);
    const existing = this.#records.get(key);
    if (existing) {
      assertMatchingReplay(existing, requestHash);
      return { kind: existing.state === "completed" ? "replay" : "started", record: existing };
    }
    const record: IdempotencyRecord = { ...scope, requestHash, state: "processing" };
    this.#records.set(key, record);
    return { kind: "started", record };
  }

  async complete(scope: IdempotencyScope, responseStatus: number, responseBody: unknown): Promise<void> {
    const existing = this.#records.get(scopeKey(scope));
    if (!existing) throw new Error("Cannot complete missing idempotency record");
    this.#records.set(scopeKey(scope), { ...existing, state: "completed", responseStatus, responseBody });
  }

  async fail(scope: IdempotencyScope): Promise<void> {
    const existing = this.#records.get(scopeKey(scope));
    if (existing) this.#records.set(scopeKey(scope), { ...existing, state: "failed" });
  }
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";
  constructor() {
    super("Idempotency key was reused with different request parameters");
    this.name = "IdempotencyConflictError";
  }
}

function scopeKey(scope: IdempotencyScope): string {
  return `${scope.appId}:${scope.operation}:${scope.key}`;
}
