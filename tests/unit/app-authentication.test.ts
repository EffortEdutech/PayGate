import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { CompositeAppAuthenticator, SupabaseHs256JwtAppAuthenticator, StaticTokenAppAuthenticator, assertAppAuthority } from "../../payment-hub/src/security/app-authentication.js";

test("supabase JWT auth maps AIntern user and enforces user_ref binding", async () => {
  const token = signHs256({
    sub: "user-123",
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1",
    aud: "authenticated",
    jti: "jwt-1",
  }, "jwt-secret");
  const authenticator = new SupabaseHs256JwtAppAuthenticator({
    appId: "aintern",
    jwtSecret: "jwt-secret",
    issuer: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1",
    audience: "authenticated",
  });

  const identity = await authenticator.authenticate(token);
  assert.equal(identity.appId, "aintern");
  assert.equal(identity.subject, "user-123");
  assert.doesNotThrow(() => assertAppAuthority(identity, "aintern", "user-123"));
  assert.throws(() => assertAppAuthority(identity, "aintern", "other-user"), /USER_REF_MISMATCH/);
});

test("composite auth preserves static app token fallback for local operator use", async () => {
  const authenticator = new CompositeAppAuthenticator([
    new StaticTokenAppAuthenticator({ aintern: "local-token" }),
    new SupabaseHs256JwtAppAuthenticator({ appId: "aintern", jwtSecret: "jwt-secret", issuer: undefined, audience: undefined }),
  ]);

  const identity = await authenticator.authenticate("local-token");
  assert.equal(identity.appId, "aintern");
  assert.doesNotThrow(() => assertAppAuthority(identity, "aintern", "any-local-user-ref"));
});

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}