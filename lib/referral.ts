// Client-side referral codes with an offline-verifiable handshake.
//
// There is no backend yet, so the "friend really joined AND added gold"
// check works as a two-way code exchange:
//
//   1. Referrer shares their INVITE CODE (derived from their user id).
//   2. The friend installs, signs in, adds their first piece of gold, then
//      enters the invite code. Their app only THEN mints a CLAIM TOKEN
//      bound to that invite code (hash(salt | inviteCode | nonce)).
//   3. The friend sends the short token back; the referrer's app verifies
//      it against their own code and counts the referral.
//
// A determined attacker could forge tokens by reverse-engineering the app,
// but the stakes (a portfolio slot) are low and every legit token requires
// the friend to genuinely reach the "gold added" state. Server-side
// verification can replace `verifyClaimToken` wholesale later.

export const APP_STORE_URL = "https://apps.apple.com/app/id6787368502";
export const REFERRAL_TARGET = 10;
export const PRO_REWARD_MONTHS = 6;

const SALT = "goldpricer.referral.v1";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

// FNV-1a — tiny, deterministic, good enough for short verification codes.
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function encode(value: number, length: number): string {
  let out = "";
  let v = value >>> 0;
  for (let i = 0; i < length; i++) {
    out += ALPHABET[v % ALPHABET.length];
    v = Math.floor(v / ALPHABET.length) ^ (v << 3) >>> 0;
    v = v >>> 0;
  }
  return out;
}

/** Stable 6-char invite code for a user id. */
export function inviteCodeForUser(userId: string): string {
  const a = fnv1a(SALT + "|code|" + userId);
  const b = fnv1a(userId + "|code|" + SALT);
  return encode(a, 3) + encode(b, 3);
}

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidInviteCodeFormat(raw: string): boolean {
  return normalize(raw).length === 6;
}

/**
 * Mint the claim token the invitee sends back to their referrer.
 * Format: NNN-TTTT (nonce + verification), e.g. "K7X-4QF2".
 */
export function mintClaimToken(inviteCode: string, inviteeUserId: string): string {
  const code = normalize(inviteCode);
  // Nonce derived from the invitee so the same person always produces the
  // same token for a given code — it can't be farmed by re-entering.
  const nonce = encode(fnv1a(SALT + "|nonce|" + inviteeUserId), 3);
  const proof = encode(fnv1a(SALT + "|claim|" + code + "|" + nonce), 4);
  return `${nonce}-${proof}`;
}

/**
 * Verify a claim token against MY invite code. Returns the nonce (used for
 * de-duplication — one credit per friend) or null if invalid.
 */
export function verifyClaimToken(myInviteCode: string, raw: string): string | null {
  const cleaned = normalize(raw);
  if (cleaned.length !== 7) return null;
  const nonce = cleaned.slice(0, 3);
  const proof = cleaned.slice(3);
  const expected = encode(
    fnv1a(SALT + "|claim|" + normalize(myInviteCode) + "|" + nonce),
    4
  );
  return proof === expected ? nonce : null;
}

export function shareMessage(inviteCode: string): string {
  return (
    `I track my gold with Gold Pricer — live spot price, portfolio gains, ` +
    `widgets, the lot. Use my invite code ${inviteCode} after you add your ` +
    `first piece and we both get an extra portfolio slot. ${APP_STORE_URL}`
  );
}
