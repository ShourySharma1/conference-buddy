import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getBadge, submitRegistration } from "@/lib/badges.functions";
import { BadgeIdCard } from "@/components/BadgeIdCard";

export const Route = createFileRoute("/b/$code")({
  head: () => ({
    meta: [
      { title: "Conference Badge — Claim or View Pass" },
      {
        name: "description",
        content:
          "Register this conference QR badge with your details, or view the pass of the attendee it belongs to.",
      },
      { property: "og:title", content: "Conference Badge — Claim or View Pass" },
      {
        property: "og:description",
        content: "Claim this QR badge with your details, or view the attendee pass it belongs to.",
      },
    ],
  }),
  component: BadgePage,
});

const EMPTY = { fullName: "", email: "", phone: "", organization: "", designation: "" };

function BadgePage() {
  const { code } = Route.useParams();
  const fetchBadge = useServerFn(getBadge);
  const register = useServerFn(submitRegistration);
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["badge", code],
    queryFn: () => fetchBadge({ data: { code } }),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Please enter a valid email.");
    setSaving(true);
    try {
      const res = await register({ data: { code, ...form } });
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else await queryClient.invalidateQueries({ queryKey: ["badge", code] });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-14">
      <Link to="/" className="label-xs hover:text-foreground">
        ← Conference badges
      </Link>

      {isPending ? (
        <p className="mt-8 text-muted-foreground">Reading badge…</p>
      ) : !data || data.status === "not_found" ? (
        <div className="surface mt-6 p-6">
          <h1 className="text-2xl font-bold">Badge not recognised</h1>
          <p className="mt-2 text-muted-foreground">
            This code isn't part of the conference badge set. Check the code under the QR, or ask at
            the registration desk for a replacement badge.
          </p>
          <p className="mt-4 font-mono text-xs break-all text-muted-foreground">{code}</p>
        </div>
      ) : data.status === "revoked" ? (
        <div className="surface mt-6 p-6">
          <h1 className="text-2xl font-bold">Badge deactivated</h1>
          <p className="mt-2 text-muted-foreground">
            Badge #{String(data.serial).padStart(4, "0")} has been deactivated by the organisers.
            Please collect a new badge at the desk.
          </p>
        </div>
      ) : data.status === "registered" ? (
        <div className="mt-6">
          <p className="label-xs">Verified pass</p>
          <h1 className="mt-1 mb-5 text-2xl font-bold">{data.profile.fullName}</h1>
          <BadgeIdCard
            badge={{
              serial: data.profile.serial,
              code: data.code,
              fullName: data.profile.fullName,
              organization: data.profile.organization,
              designation: data.profile.designation,
              ticketType: data.profile.ticketType,
            }}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Registered {new Date(data.profile.registeredAt).toLocaleString()}. Contact details are
            visible to organisers only.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <p className="label-xs">Badge #{String(data.serial).padStart(4, "0")} · unclaimed</p>
          <h1 className="mt-2 text-3xl font-bold">Make this badge yours</h1>
          <p className="mt-2 text-muted-foreground">
            Fill this in once. It links your details to this QR code for the whole conference.
          </p>

          <form onSubmit={onSubmit} className="surface mt-6 grid gap-4 p-5">
            <Field
              label="Full name *"
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
              placeholder="Ada Lovelace"
            />
            <Field
              label="Email *"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="ada@example.com"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="+91 90000 00000"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Organisation"
                value={form.organization}
                onChange={(v) => setForm({ ...form, organization: v })}
                placeholder="Analytical Engines Ltd."
              />
              <Field
                label="Designation"
                value={form.designation}
                onChange={(v) => setForm({ ...form, designation: v })}
                placeholder="Lead Engineer"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
              {saving ? "Saving…" : "Claim this badge"}
            </button>
            <p className="text-xs text-muted-foreground">
              Only your name, organisation and role appear on the public pass. Email and phone stay
              with the organisers.
            </p>
          </form>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field focus:field-focus mt-2"
      />
    </label>
  );
}
