import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { Context, Next } from "hono";

// Sign in with Apple: the app sends the identityToken it received from
// AppleAuthentication; we verify it against Apple's public JWKS. This is
// the standard server-side SIWA flow — no Apple secret required for
// verification, only for token refresh flows we don't use.

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const APPLE_ISSUER = "https://appleid.apple.com";
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.mbeidas.goldtracker";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);
const SESSION_TTL = "180d"; // mobile sessions are long-lived; SIWA revocation
// is checked client-side via getCredentialStateAsync on every launch.

export interface AppleIdentity {
  sub: string;
  email?: string;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const { payload } = await jwtVerify(token, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: BUNDLE_ID,
  });
  if (!payload.sub) throw new Error("missing sub");
  return { sub: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined };
}

export async function issueSessionToken(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

/** Hono middleware: requires a valid session; sets c.var userId. */
export async function requireUser(c: Context, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", userId);
  await next();
}

/** Hono middleware: admin endpoints, gated by a static bearer token. */
export async function requireAdmin(c: Context, next: Next) {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return c.json({ error: "admin disabled: set ADMIN_TOKEN" }, 503);
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : (c.req.query("token") ?? "");
  if (token !== configured) return c.json({ error: "unauthorized" }, 401);
  await next();
}
