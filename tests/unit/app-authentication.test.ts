import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { CompositeAppAuthenticator, SupabaseJwtAppAuthenticator, SupabaseHs256JwtAppAuthenticator, StaticTokenAppAuthenticator, assertAppAuthority } from "../../payment-hub/src/security/app-authentication.js";

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


test("supabase ES256 JWKS auth verifies modern Supabase signing keys", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  jwk.kid = "test-key-id";
  jwk.alg = "ES256";
  jwk.key_ops = ["verify"];
  const token = signEs256({
    sub: "user-456",
    exp: Math.floor(Date.now() / 1000) + 300,
    iss: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1",
    aud: "authenticated",
  }, privateKey, "test-key-id");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const authenticator = new SupabaseJwtAppAuthenticator({
      appId: "aintern",
      jwtSecret: undefined,
      jwksUrl: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1/.well-known/jwks.json",
      issuer: "https://wdhdjhvvngssnszqgiyk.supabase.co/auth/v1",
      audience: "authenticated",
    });
    const identity = await authenticator.authenticate(token);
    assert.equal(identity.appId, "aintern");
    assert.equal(identity.subject, "user-456");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("composite auth preserves static app token fallback for local operator use", async () => {
  const authenticator = new CompositeAppAuthenticator([
    new StaticTokenAppAuthenticator({ aintern: "local-token" }),
    new SupabaseHs256JwtAppAuthenticator({ appId: "aintern", jwtSecret: "jwt-secret", jwksUrl: undefined, issuer: undefined, audience: undefined }),
  ]);

  const identity = await authenticator.authenticate("local-token");
  assert.equal(identity.appId, "aintern");
  assert.doesNotThrow(() => assertAppAuthority(identity, "aintern", "any-local-user-ref"));
});

function signEs256(payload: Record<string, unknown>, privateKey: import("node:crypto").KeyObject, kid: string): string {
  const header = { alg: "ES256", typ: "JWT", kid };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = sign(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

type JsonWebKey = import("node:crypto").JsonWebKey;

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