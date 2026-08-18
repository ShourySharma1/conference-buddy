import { createHash, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";
import { activeCodec, ACTIVE_CODEC, looksLikeBadgeToken } from "./badge-codec.server";

/* ------------------------------- admin session ------------------------------ */

type AdminSession = { admin?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "conf-admin",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function isAdmin(): Promise<boolean> {
  const session = await useSession<AdminSession>(sessionConfig());
  return session.data.admin === true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function loginAdmin(passcode: string): Promise<boolean> {
  const expected = process.env["ADMIN_PASSCODE"];
  if (!expected) throw new Error("ADMIN_PASSCODE is not configured");
  if (!timingSafeEqual(digest(passcode), digest(expected))) return false;
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ admin: true });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
}

/* --------------------------------- database -------------------------------- */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicProfile = {
  serial: number;
  fullName: string;
  organization: string | null;
  designation: string | null;
  ticketType: string;
  registeredAt: string;
};

export type BadgeLookup =
  | { status: "not_found" }
  | { status: "revoked"; serial: number }
  | { status: "unregistered"; code: string; serial: number }
  | { status: "registered"; code: string; profile: PublicProfile };

export async function lookupBadge(code: string): Promise<BadgeLookup> {
  if (!looksLikeBadgeToken(code)) return { status: "not_found" };
  const supabase = await db();
  const { data: badge } = await supabase
    .from("badges")
    .select("id, serial, token, revoked")
    .eq("token", code)
    .maybeSingle();

  if (!badge) return { status: "not_found" };
  if (badge.revoked) return { status: "revoked", serial: badge.serial };

  const { data: attendee } = await supabase
    .from("attendees")
    .select("full_name, organization, designation, ticket_type, created_at")
    .eq("badge_id", badge.id)
    .maybeSingle();

  if (!attendee) return { status: "unregistered", code, serial: badge.serial };

  return {
    status: "registered",
    code,
    profile: {
      serial: badge.serial,
      fullName: attendee.full_name,
      organization: attendee.organization,
      designation: attendee.designation,
      ticketType: attendee.ticket_type,
      registeredAt: attendee.created_at,
    },
  };
}

export type RegistrationInput = {
  code: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  designation: string;
};

export async function registerBadge(
  input: RegistrationInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await db();
  const { data: badge } = await supabase
    .from("badges")
    .select("id, revoked")
    .eq("token", input.code)
    .maybeSingle();

  if (!badge) return { ok: false, error: "This QR code is not part of the conference set." };
  if (badge.revoked) return { ok: false, error: "This badge has been deactivated. Please ask the desk for a new one." };

  const { data: existing } = await supabase
    .from("attendees")
    .select("id")
    .eq("badge_id", badge.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "This badge is already claimed by someone else." };

  const { error } = await supabase.from("attendees").insert({
    badge_id: badge.id,
    full_name: input.fullName,
    email: input.email || null,
    phone: input.phone || null,
    organization: input.organization || null,
    designation: input.designation || null,
  });

  // Unique violation = someone claimed it a split second earlier.
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "This badge was just claimed by someone else." : "Could not save your details. Please try again.",
    };
  }
  return { ok: true };
}

/* ------------------------------- admin queries ------------------------------ */

export type AdminBadge = {
  id: string;
  serial: number;
  token: string;
  codec: string;
  batch: string;
  revoked: boolean;
  createdAt: string;
  attendee: {
    fullName: string;
    email: string | null;
    phone: string | null;
    organization: string | null;
    designation: string | null;
    ticketType: string;
    registeredAt: string;
  } | null;
};

export async function generateBadges(count: number, batch: string): Promise<AdminBadge[]> {
  const supabase = await db();
  const codec = activeCodec();

  const { data: last } = await supabase
    .from("badges")
    .select("serial")
    .order("serial", { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = (last?.serial ?? 0) + 1;
  const rows: { serial: number; token: string; codec: string; batch: string }[] = [];
  const seen = new Set<string>();
  while (rows.length < count) {
    const serial = next++;
    const token = codec.encode(serial);
    if (seen.has(token)) continue;
    seen.add(token);
    rows.push({ serial, token, codec: ACTIVE_CODEC, batch });
  }

  const { error } = await supabase.from("badges").insert(rows);
  if (error) throw new Error(error.message);
  return listBadges();
}

export async function listBadges(): Promise<AdminBadge[]> {
  const supabase = await db();
  const { data: badges, error } = await supabase
    .from("badges")
    .select("id, serial, token, codec, batch, revoked, created_at")
    .order("serial", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: attendees } = await supabase
    .from("attendees")
    .select("badge_id, full_name, email, phone, organization, designation, ticket_type, created_at");

  const byBadge = new Map((attendees ?? []).map((a) => [a.badge_id, a]));

  return (badges ?? []).map((b) => {
    const a = byBadge.get(b.id);
    return {
      id: b.id,
      serial: b.serial,
      token: b.token,
      codec: b.codec,
      batch: b.batch,
      revoked: b.revoked,
      createdAt: b.created_at,
      attendee: a
        ? {
            fullName: a.full_name,
            email: a.email,
            phone: a.phone,
            organization: a.organization,
            designation: a.designation,
            ticketType: a.ticket_type,
            registeredAt: a.created_at,
          }
        : null,
    };
  });
}

export async function setRevoked(badgeId: string, revoked: boolean): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("badges").update({ revoked }).eq("id", badgeId);
  if (error) throw new Error(error.message);
}

export async function clearRegistration(badgeId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("attendees").delete().eq("badge_id", badgeId);
  if (error) throw new Error(error.message);
}

export function badgesToCsv(badges: AdminBadge[]): string {
  const header = [
    "serial",
    "qr_code",
    "codec",
    "batch",
    "revoked",
    "full_name",
    "email",
    "phone",
    "organization",
    "designation",
    "ticket_type",
    "registered_at",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = badges.map((b) =>
    [
      b.serial,
      b.token,
      b.codec,
      b.batch,
      b.revoked ? "yes" : "no",
      b.attendee?.fullName,
      b.attendee?.email,
      b.attendee?.phone,
      b.attendee?.organization,
      b.attendee?.designation,
      b.attendee?.ticketType,
      b.attendee?.registeredAt,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
