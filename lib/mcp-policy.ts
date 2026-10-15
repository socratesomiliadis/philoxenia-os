import { z } from "zod";

export const READ_SCOPE = "organizer:read";
export const WRITE_SCOPE = "organizer:write";
export function canonicalMcpOrigin(value: string) {
  safeRedirectUri(value);
  const url = new URL(value);
  if (url.pathname !== "/" || url.search) throw new Error("SITE_URL must be the app origin without a path or query.");
  return url.origin;
}
export const scopesValidator = z.array(z.enum([READ_SCOPE, WRITE_SCOPE])).min(1).max(2);
export function parseScopes(value = READ_SCOPE) {
  const scopes = [...new Set(value.split(" ").filter(Boolean))];
  const parsed = scopesValidator.parse(scopes);
  if (!parsed.includes(READ_SCOPE)) throw new Error("Read access is required.");
  return parsed;
}

export function safeRedirectUri(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.hash || value.length > 2048) throw new Error("Invalid redirect URI.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Redirect URIs must use HTTPS or loopback HTTP.");
  }
  return value;
}

export const authorizationSchema = z.object({
  client_id: z.string().min(1).max(200), redirect_uri: z.string().max(2048),
  response_type: z.literal("code"), code_challenge_method: z.literal("S256"),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  state: z.string().max(2048).optional(), scope: z.string().max(100).default(READ_SCOPE),
  resource: z.string().url(),
});

export async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function randomSecret(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return prefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
