import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.object({ code: z.string().trim().min(1).max(128) });

const registrationSchema = z.object({
  code: z.string().trim().min(1).max(128),
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(30).default(""),
  organization: z.string().trim().max(120).default(""),
  designation: z.string().trim().max(120).default(""),
});

export const getBadge = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => codeSchema.parse(data))
  .handler(async ({ data }) => {
    const { lookupBadge } = await import("./badges.server");
    return lookupBadge(data.code);
  });

export const submitRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    const { registerBadge } = await import("./badges.server");
    return registerBadge(data);
  });

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./badges.server");
  return { admin: await isAdmin() };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ passcode: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { loginAdmin } = await import("./badges.server");
    return { ok: await loginAdmin(data.passcode) };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutAdmin } = await import("./badges.server");
  await logoutAdmin();
  return { ok: true };
});

export const adminBadges = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, listBadges } = await import("./badges.server");
  await requireAdmin();
  return listBadges();
});

export const adminGenerate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        count: z.number().int().min(1).max(2000),
        batch: z.string().trim().min(1).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, generateBadges } = await import("./badges.server");
    await requireAdmin();
    return generateBadges(data.count, data.batch);
  });

export const adminRevoke = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ badgeId: z.string().uuid(), revoked: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, setRevoked, listBadges } = await import("./badges.server");
    await requireAdmin();
    await setRevoked(data.badgeId, data.revoked);
    return listBadges();
  });

export const adminClearRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ badgeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, clearRegistration, listBadges } = await import("./badges.server");
    await requireAdmin();
    await clearRegistration(data.badgeId);
    return listBadges();
  });

export const adminCsv = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, listBadges, badgesToCsv } = await import("./badges.server");
  await requireAdmin();
  return { csv: badgesToCsv(await listBadges()) };
});
