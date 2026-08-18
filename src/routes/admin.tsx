import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adminBadges,
  adminClearRegistration,
  adminCsv,
  adminGenerate,
  adminLogin,
  adminLogout,
  adminRevoke,
  adminStatus,
} from "@/lib/badges.functions";
import { BadgeIdCard } from "@/components/BadgeIdCard";
import { downloadBlob, downloadQrZip, badgeUrl } from "@/lib/qr";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Organiser Dashboard — Conference Badges" },
      {
        name: "description",
        content:
          "Generate conference QR badges in bulk, download and print them, and review every attendee registration.",
      },
      { property: "og:title", content: "Organiser Dashboard — Conference Badges" },
      {
        property: "og:description",
        content: "Generate, print and manage conference QR badges and attendee registrations.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(adminStatus);
  const { data, isPending } = useQuery({ queryKey: ["admin-status"], queryFn: () => status() });

  if (isPending) return <Shell><p className="text-muted-foreground">Checking access…</p></Shell>;
  return data?.admin ? <Dashboard /> : <PasscodeGate />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-12">
      <div className="no-print mb-8 flex items-center justify-between">
        <Link to="/" className="label-xs hover:text-foreground">
          ← Badge system
        </Link>
        <p className="label-xs">Organiser dashboard</p>
      </div>
      {children}
    </main>
  );
}

function PasscodeGate() {
  const login = useServerFn(adminLogin);
  const queryClient = useQueryClient();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Shell>
      <form
        className="surface mx-auto max-w-sm p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          const res = await login({ data: { passcode } });
          setBusy(false);
          if (res.ok) await queryClient.invalidateQueries({ queryKey: ["admin-status"] });
          else setError(true);
        }}
      >
        <h1 className="text-2xl font-bold">Organiser access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the shared organiser passcode to manage badges and attendee data.
        </p>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="field focus:field-focus mt-5"
          placeholder="Passcode"
        />
        {error ? <p className="mt-2 text-sm text-destructive">Incorrect passcode.</p> : null}
        <button type="submit" disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </Shell>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminBadges);
  const generateFn = useServerFn(adminGenerate);
  const revokeFn = useServerFn(adminRevoke);
  const clearFn = useServerFn(adminClearRegistration);
  const csvFn = useServerFn(adminCsv);
  const logoutFn = useServerFn(adminLogout);

  const { data: badges = [], isPending } = useQuery({
    queryKey: ["admin-badges"],
    queryFn: () => listFn(),
  });

  const [count, setCount] = useState(500);
  const [batch, setBatch] = useState("batch-1");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "registered" | "open">("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const registered = badges.filter((b) => b.attendee).length;
    return {
      total: badges.length,
      registered,
      open: badges.filter((b) => !b.attendee && !b.revoked).length,
      revoked: badges.filter((b) => b.revoked).length,
    };
  }, [badges]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return badges.filter((b) => {
      if (filter === "registered" && !b.attendee) return false;
      if (filter === "open" && (b.attendee || b.revoked)) return false;
      if (!q) return true;
      return [
        String(b.serial),
        b.token,
        b.batch,
        b.attendee?.fullName,
        b.attendee?.email,
        b.attendee?.organization,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [badges, filter, search]);

  async function refresh(next: unknown) {
    queryClient.setQueryData(["admin-badges"], next);
  }

  return (
    <Shell>
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Badges & attendees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendee contact details are visible on this page only.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await logoutFn();
            await queryClient.invalidateQueries({ queryKey: ["admin-status"] });
          }}
        >
          Lock dashboard
        </button>
      </div>

      <section className="no-print mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total QRs", stats.total],
          ["Registered", stats.registered],
          ["Unclaimed", stats.open],
          ["Deactivated", stats.revoked],
        ].map(([label, value]) => (
          <div key={String(label)} className="surface p-4">
            <p className="label-xs">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface no-print mt-6 flex flex-wrap items-end gap-3 p-5">
        <label className="block">
          <span className="label-xs">How many QRs</span>
          <input
            type="number"
            min={1}
            max={2000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="field focus:field-focus mt-2 w-32"
          />
        </label>
        <label className="block">
          <span className="label-xs">Batch label</span>
          <input
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="field focus:field-focus mt-2 w-44"
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("generate");
            try {
              const next = await generateFn({ data: { count, batch } });
              await refresh(next);
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "generate" ? "Generating…" : `Generate ${count} more`}
        </button>
        <div className="grow" />
        <button
          className="btn btn-ghost"
          disabled={busy !== null || badges.length === 0}
          onClick={async () => {
            setBusy("zip");
            try {
              await downloadQrZip(visible.length ? visible : badges, (done, total) =>
                setProgress(`${done} / ${total}`),
              );
            } finally {
              setBusy(null);
              setProgress(null);
            }
          }}
        >
          {busy === "zip" ? `Zipping ${progress ?? ""}` : "Download QR images (.zip)"}
        </button>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          Print ID cards
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const { csv } = await csvFn();
            downloadBlob(new Blob([csv], { type: "text/csv" }), "conference-attendees.csv");
          }}
        >
          Export CSV
        </button>
      </section>

      <section className="no-print mt-8 flex flex-wrap items-center gap-3">
        {(["all", "registered", "open"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
          >
            {f === "all" ? "All" : f === "registered" ? "Registered" : "Unclaimed"}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, code…"
          className="field focus:field-focus max-w-xs"
        />
      </section>

      {isPending ? (
        <p className="mt-8 text-muted-foreground">Loading badges…</p>
      ) : badges.length === 0 ? (
        <p className="surface mt-8 p-6 text-muted-foreground">
          No badges yet. Generate your first batch above.
        </p>
      ) : (
        <>
          <div className="surface no-print mt-6 overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="label-xs">
                <tr className="border-b border-border">
                  <th className="p-3">#</th>
                  <th className="p-3">Attendee</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 align-top">
                    <td className="p-3 font-mono">{String(b.serial).padStart(4, "0")}</td>
                    <td className="p-3">
                      {b.attendee ? (
                        <>
                          <p className="font-semibold">{b.attendee.fullName}</p>
                          <p className="text-muted-foreground">
                            {[b.attendee.designation, b.attendee.organization]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unclaimed</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {b.attendee ? (
                        <>
                          <p>{b.attendee.email ?? "—"}</p>
                          <p>{b.attendee.phone ?? "—"}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-mono text-xs break-all">{b.token}</p>
                      <a
                        href={badgeUrl(b.token)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        open badge
                      </a>
                    </td>
                    <td className="p-3 text-muted-foreground">{b.batch}</td>
                    <td className="p-3">
                      {b.revoked ? (
                        <span className="text-destructive">Deactivated</span>
                      ) : b.attendee ? (
                        <span className="text-success">Registered</span>
                      ) : (
                        <span className="text-muted-foreground">Open</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={async () =>
                            refresh(await revokeFn({ data: { badgeId: b.id, revoked: !b.revoked } }))
                          }
                        >
                          {b.revoked ? "Reactivate" : "Deactivate"}
                        </button>
                        {b.attendee ? (
                          <button
                            className="text-xs text-destructive hover:underline"
                            onClick={async () => {
                              if (!confirm(`Clear registration for badge ${b.serial}?`)) return;
                              refresh(await clearFn({ data: { badgeId: b.id } }));
                            }}
                          >
                            Clear registration
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="no-print mt-12 text-xl font-bold">Printable ID cards</h2>
          <div className="print-sheet mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <BadgeIdCard
                key={b.id}
                printable
                compact
                badge={{
                  serial: b.serial,
                  code: b.token,
                  fullName: b.attendee?.fullName ?? null,
                  organization: b.attendee?.organization ?? null,
                  designation: b.attendee?.designation ?? null,
                  ticketType: b.attendee?.ticketType ?? "attendee",
                }}
              />
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
