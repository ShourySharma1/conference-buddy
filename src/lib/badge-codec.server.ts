/**
 * PLUGGABLE BADGE CODEC
 * ---------------------
 * A "codec" turns a badge serial number into the opaque string that gets
 * printed inside the QR code (encode) and back again (decode).
 *
 * To swap in your own encoder/decoder:
 *   1. Write an object that satisfies `BadgeCodec` below.
 *   2. Register it in the `CODECS` map.
 *   3. Point `ACTIVE_CODEC` at its name.
 *
 * Existing badges keep working because every badge row stores the name of the
 * codec that produced it, and lookups always fall back to a direct token match
 * in the database.
 */
import { createHmac, randomBytes } from "node:crypto";

export interface BadgeCodec {
  name: string;
  /** serial -> token embedded in the QR */
  encode: (serial: number) => string;
  /** token -> serial, or null when the token is not valid for this codec */
  decode: (token: string) => number | null;
}

function secret(): string {
  const value = process.env["BADGE_CODEC_SECRET"];
  if (!value) throw new Error("BADGE_CODEC_SECRET is not configured");
  return value;
}

function sign(payload: string, length: number): string {
  return createHmac("sha256", secret())
    .update(payload, "utf8")
    .digest("base64url")
    .slice(0, length);
}

/** Signed, verifiable, and offline-decodable. Default. */
const hmacV1: BadgeCodec = {
  name: "hmac-v1",
  encode: (serial) => {
    const body = serial.toString(36).toUpperCase().padStart(4, "0");
    return `${body}-${sign(body, 10)}`;
  },
  decode: (token) => {
    const [body, sig] = token.split("-");
    if (!body || !sig) return null;
    if (sign(body, 10) !== sig) return null;
    const serial = parseInt(body, 36);
    return Number.isFinite(serial) ? serial : null;
  },
};

/** Fully opaque random token. Not decodable offline; resolved via database. */
const randomV1: BadgeCodec = {
  name: "random-v1",
  encode: () => randomBytes(12).toString("base64url"),
  decode: () => null,
};

export const CODECS: Record<string, BadgeCodec> = {
  [hmacV1.name]: hmacV1,
  [randomV1.name]: randomV1,
};

/** Change this single line to switch which codec new QRs are generated with. */
export const ACTIVE_CODEC = "hmac-v1";

export function activeCodec(): BadgeCodec {
  const codec = CODECS[ACTIVE_CODEC];
  if (!codec) throw new Error(`Unknown codec: ${ACTIVE_CODEC}`);
  return codec;
}

/** Try every registered codec; used only as a fast sanity check before a DB hit. */
export function looksLikeBadgeToken(token: string): boolean {
  if (!token || token.length > 128) return false;
  return Object.values(CODECS).some((c) => c.decode(token) !== null) || /^[A-Za-z0-9_-]+$/.test(token);
}
