import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import type { SupabaseJwtAuthConfig } from "../config.js";

export interface AuthenticatedApplication {
  readonly appId: string;
  readonly subject: string;
  readonly tokenId: string;
  readonly expiresAt: Date;
}

export interface AppAuthenticator {
  authenticate(bearerToken: string): Promise<AuthenticatedApplication>;
}

export class CompositeAppAuthenticator implements AppAuthenticator {
  constructor(readonly authenticators: readonly AppAuthenticator[]) {}

  async authenticate(bearerToken: string): Promise<AuthenticatedApplication> {
    let lastError: unknown;
    for (const authenticator of this.authenticators) {
      try {
        return await authenticator.authenticate(bearerToken);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof AuthenticationError) throw lastError;
    throw new AuthenticationError("INVALID_APP_TOKEN");
  }
}

export class StaticTokenAppAuthenticator implements AppAuthenticator {
  readonly #tokensByApp: Readonly<Record<string, string>>;

  constructor(tokensByApp: Readonly<Record<string, string>>) {
    this.#tokensByApp = tokensByApp;
  }

  async authenticate(bearerToken: string): Promise<AuthenticatedApplication> {
    for (const [appId, token] of Object.entries(this.#tokensByApp)) {
      if (token === bearerToken) {
        return { appId, subject: `app:${appId}`, tokenId: `static:${appId}`, expiresAt: new Date(Date.now() + 300_000) };
      }
    }
    throw new AuthenticationError("INVALID_APP_TOKEN");
  }
}

export class SupabaseJwtAppAuthenticator implements AppAuthenticator {
  readonly #jwksCache = new Map<string, JsonWebKey>();

  constructor(readonly config: SupabaseJwtAuthConfig) {}

  async authenticate(bearerToken: string): Promise<AuthenticatedApplication> {
    const parts = bearerToken.split(".");
    if (parts.length !== 3) throw new AuthenticationError("INVALID_APP_TOKEN");
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const header = parseJwtPart(encodedHeader) as Record<string, unknown>;

    if (header.alg === "HS256" && this.config.jwtSecret) {
      verifyHs256(this.config.jwtSecret, encodedHeader, encodedPayload, encodedSignature);
    } else if (header.alg === "ES256" && this.config.jwksUrl) {
      await this.verifyEs256(header, encodedHeader, encodedPayload, encodedSignature);
    } else {
      throw new AuthenticationError("INVALID_APP_TOKEN");
    }

    const payload = parseJwtPart(encodedPayload) as Record<string, unknown>;
    const subject = typeof payload.sub === "string" ? payload.sub : undefined;
    const expiresAtSeconds = typeof payload.exp === "number" ? payload.exp : undefined;
    if (!subject || !expiresAtSeconds) throw new AuthenticationError("INVALID_APP_TOKEN");
    if (expiresAtSeconds * 1000 <= Date.now()) throw new AuthenticationError("INVALID_APP_TOKEN");
    if (this.config.issuer && payload.iss !== this.config.issuer) throw new AuthenticationError("INVALID_APP_TOKEN");
    if (this.config.audience && !audienceMatches(payload.aud, this.config.audience)) throw new AuthenticationError("INVALID_APP_TOKEN");

    const tokenId = typeof payload.jti === "string" ? payload.jti : `supabase:${subject}`;
    return { appId: this.config.appId, subject, tokenId, expiresAt: new Date(expiresAtSeconds * 1000) };
  }

  private async verifyEs256(header: Record<string, unknown>, encodedHeader: string, encodedPayload: string, encodedSignature: string): Promise<void> {
    const kid = typeof header.kid === "string" ? header.kid : undefined;
    if (!kid) throw new AuthenticationError("INVALID_APP_TOKEN");
    const jwk = await this.getJwk(kid);
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const valid = verify("sha256", Buffer.from(`${encodedHeader}.${encodedPayload}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, base64UrlDecode(encodedSignature));
    if (!valid) throw new AuthenticationError("INVALID_APP_TOKEN");
  }

  private async getJwk(kid: string): Promise<JsonWebKey> {
    const cached = this.#jwksCache.get(kid);
    if (cached) return cached;
    if (!this.config.jwksUrl) throw new AuthenticationError("INVALID_APP_TOKEN");
    const response = await fetch(this.config.jwksUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new AuthenticationError("INVALID_APP_TOKEN");
    const document = await response.json() as { keys?: JsonWebKey[] };
    for (const key of document.keys ?? []) {
      if (typeof key.kid === "string") this.#jwksCache.set(key.kid, key);
    }
    const jwk = this.#jwksCache.get(kid);
    if (!jwk) throw new AuthenticationError("INVALID_APP_TOKEN");
    return jwk;
  }
}

export const SupabaseHs256JwtAppAuthenticator = SupabaseJwtAppAuthenticator;

export function assertAppAuthority(identity: AuthenticatedApplication, requestedAppId: string, requestedUserRef?: string): void {
  if (identity.appId !== requestedAppId) throw new AuthorizationError("APP_ID_MISMATCH");
  if (identity.expiresAt.getTime() <= Date.now()) throw new AuthorizationError("TOKEN_EXPIRED");
  if (requestedUserRef && !identity.subject.startsWith("app:") && identity.subject !== requestedUserRef) {
    throw new AuthorizationError("USER_REF_MISMATCH");
  }
}

export function readBearerToken(authorizationHeader: string | undefined): string {
  const [scheme, token] = authorizationHeader?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) throw new AuthenticationError("MISSING_BEARER_TOKEN");
  return token;
}

function verifyHs256(secret: string, encodedHeader: string, encodedPayload: string, encodedSignature: string): void {
  const expectedSignature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  const actualSignature = base64UrlDecode(encodedSignature);
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new AuthenticationError("INVALID_APP_TOKEN");
  }
}

function parseJwtPart(encoded: string): unknown {
  return JSON.parse(base64UrlDecode(encoded).toString("utf8")) as unknown;
}

function base64UrlDecode(encoded: string): Buffer {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function audienceMatches(actual: unknown, expected: string): boolean {
  if (typeof actual === "string") return actual === expected;
  return Array.isArray(actual) && actual.includes(expected);
}

export class AuthorizationError extends Error {
  constructor(readonly code: "APP_ID_MISMATCH" | "TOKEN_EXPIRED" | "USER_REF_MISMATCH") {
    super(code);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  constructor(readonly code: "MISSING_BEARER_TOKEN" | "INVALID_APP_TOKEN") {
    super(code);
    this.name = "AuthenticationError";
  }
}