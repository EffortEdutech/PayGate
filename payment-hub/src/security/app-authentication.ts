import { createHmac, timingSafeEqual } from "node:crypto";
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

export class SupabaseHs256JwtAppAuthenticator implements AppAuthenticator {
  constructor(readonly config: SupabaseJwtAuthConfig) {}

  async authenticate(bearerToken: string): Promise<AuthenticatedApplication> {
    const parts = bearerToken.split(".");
    if (parts.length !== 3) throw new AuthenticationError("INVALID_APP_TOKEN");
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const header = parseJwtPart(encodedHeader) as Record<string, unknown>;
    if (header.alg !== "HS256") throw new AuthenticationError("INVALID_APP_TOKEN");

    const expectedSignature = createHmac("sha256", this.config.jwtSecret).update(`${encodedHeader}.${encodedPayload}`).digest();
    const actualSignature = base64UrlDecode(encodedSignature);
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
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
}

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