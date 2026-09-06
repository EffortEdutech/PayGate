import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../../api/index.ts";

type CapturedResponse = {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
};

async function invoke(path: string, headers: Record<string, string> = {}): Promise<CapturedResponse> {
  let status = 0;
  let responseHeaders: Record<string, string> = {};
  let rawBody = "";
  const req = { method: "GET", url: path, headers } as IncomingMessage;
  const res = {
    writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
      status = nextStatus;
      responseHeaders = nextHeaders;
    },
    end(body?: string) {
      rawBody = body ?? "";
    },
  } as ServerResponse;

  await handler(req, res);

  return {
    status,
    headers: responseHeaders,
    body: parseBody(rawBody),
  };
}

function parseBody(rawBody: string): unknown {
  if (!rawBody) return undefined;
  try { return JSON.parse(rawBody); }
  catch { return rawBody; }
}

function withEnv<T>(env: Record<string, string | undefined>, action: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) previous.set(key, process.env[key]);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return action().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("Vercel health remains public while diagnostics require operator token", async () => {
  await withEnv({ OPERATOR_DIAGNOSTICS_TOKEN: undefined }, async () => {
    const health = await invoke("/health", { "x-request-id": "req_health" });
    assert.equal(health.status, 200);
    assert.equal((health.body as { status: string }).status, "ok");

    const diagnostics = await invoke("/diagnostics/runtime", { "x-request-id": "req_diag" });
    assert.equal(diagnostics.status, 503);
    assert.equal((diagnostics.body as { error: { code: string } }).error.code, "DIAGNOSTICS_AUTH_NOT_CONFIGURED");
  });
});

test("Vercel diagnostics reject missing or incorrect operator bearer token", async () => {
  await withEnv({ OPERATOR_DIAGNOSTICS_TOKEN: "operator-secret" }, async () => {
    for (const path of ["/diagnostics/runtime", "/diagnostics/ready"]) {
      const missing = await invoke(path, { "x-request-id": `req_missing_${path}` });
      assert.equal(missing.status, 401);
      assert.equal((missing.body as { error: { code: string } }).error.code, "UNAUTHORIZED");

      const wrong = await invoke(path, { authorization: "Bearer wrong-token", "x-request-id": `req_wrong_${path}` });
      assert.equal(wrong.status, 401);
      assert.equal((wrong.body as { error: { code: string } }).error.code, "UNAUTHORIZED");
    }
  });
});

test("Vercel runtime diagnostics allow valid operator token without returning secrets", async () => {
  await withEnv({
    OPERATOR_DIAGNOSTICS_TOKEN: "operator-secret",
    APP_AUTH_ISSUER: "https://pay-gate-beta.vercel.app",
    APP_AUTH_AUDIENCE: "payment-hub",
    PAYMENT_HUB_CORS_ALLOW_ORIGIN: "https://a-intern.vercel.app",
    SUPABASE_JWKS_URL: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1/.well-known/jwks.json",
    SUPABASE_JWT_APP_ID: "aintern",
    SUPABASE_JWT_ISSUER: "https://wdhdjhvvngsszqgiyk.supabase.co/auth/v1",
    SUPABASE_JWT_AUDIENCE: "authenticated",
    DATABASE_URL: "postgresql://postgres.project:secret%23value@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
    STRIPE_ACCOUNTS: "nhl_global_solution",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY: "sk_test_secretvalue",
    STRIPE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET: "whsec_secretvalue",
    STRIPE_LIVE_ACCOUNTS: "nhl_global_solution,primary",
    STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_SECRET_KEY: "sk_live_secretvalue",
    STRIPE_LIVE_ACCOUNT_NHL_GLOBAL_SOLUTION_WEBHOOK_SECRET: "whsec_live_secretvalue",
  }, async () => {
    const response = await invoke("/diagnostics/runtime", {
      authorization: "Bearer operator-secret",
      "x-request-id": "req_runtime_allowed",
    });

    assert.equal(response.status, 200);
    const serialized = JSON.stringify(response.body);
    assert.match(serialized, /config_shape_failed/);
    assert.match(serialized, /STRIPE_LIVE_ACCOUNTS/);
    assert.match(serialized, /nhl_global_solution/);
    assert.doesNotMatch(serialized, /sk_test_secretvalue/);
    assert.doesNotMatch(serialized, /whsec_secretvalue/);
    assert.doesNotMatch(serialized, /sk_live_secretvalue/);
    assert.doesNotMatch(serialized, /whsec_live_secretvalue/);
    assert.doesNotMatch(serialized, /secret%23value/);
  });
});
test("Vercel admin summary requires operator bearer token before runtime access", async () => {
  await withEnv({ OPERATOR_DIAGNOSTICS_TOKEN: "operator-secret" }, async () => {
    const missing = await invoke("/admin/summary", { "x-request-id": "req_admin_missing" });
    assert.equal(missing.status, 401);
    assert.equal((missing.body as { error: { code: string } }).error.code, "UNAUTHORIZED");

    const wrong = await invoke("/admin/summary", { authorization: "Bearer wrong-token", "x-request-id": "req_admin_wrong" });
    assert.equal(wrong.status, 401);
    assert.equal((wrong.body as { error: { code: string } }).error.code, "UNAUTHORIZED");
  });
});

test("Vercel admin console shell does not embed operator token", async () => {
  await withEnv({ OPERATOR_DIAGNOSTICS_TOKEN: "operator-secret" }, async () => {
    const response = await invoke("/admin", { "x-request-id": "req_admin_shell" });
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
    assert.doesNotMatch(String(response.body), /operator-secret/);
  });
});
test("Vercel monitoring summary requires operator bearer token before runtime access", async () => {
  await withEnv({ OPERATOR_DIAGNOSTICS_TOKEN: "operator-secret" }, async () => {
    const missing = await invoke("/admin/monitoring", { "x-request-id": "req_monitoring_missing" });
    assert.equal(missing.status, 401);
    assert.equal((missing.body as { error: { code: string } }).error.code, "UNAUTHORIZED");

    const wrong = await invoke("/admin/monitoring", { authorization: "Bearer wrong-token", "x-request-id": "req_monitoring_wrong" });
    assert.equal(wrong.status, 401);
    assert.equal((wrong.body as { error: { code: string } }).error.code, "UNAUTHORIZED");
  });
});