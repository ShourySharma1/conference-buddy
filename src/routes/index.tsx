import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conference Badge Check-In — Scan & Register" },
      {
        name: "description",
        content:
          "Pick up a QR badge, scan it, and register your details for the conference. Organisers manage all badges from the admin dashboard.",
      },
      { property: "og:title", content: "Conference Badge Check-In — Scan & Register" },
      {
        property: "og:description",
        content: "Scan your conference QR badge to claim it and see attendee passes.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-16">
      <p className="label-xs">Badge system</p>
      <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
        Scan your badge.
        <br />
        <span className="text-primary">Claim your identity.</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Every printed QR code is anonymous until someone claims it. Scan the code on your badge,
        fill in your details once, and that badge becomes your conference ID for the rest of the
        event.
      </p>

      <form
        className="surface mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim();
          if (trimmed) navigate({ to: "/b/$code", params: { code: trimmed } });
        }}
      >
        <div className="flex-1">
          <label className="label-xs" htmlFor="code">
            Can't scan? Enter the code printed under the QR
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 001A-xxxxxxxxxx"
            className="field focus:field-focus mt-2 font-mono"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Open badge
        </button>
      </form>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { n: "1", t: "Pick any badge", d: "Codes are distributed randomly — no pre-assignment." },
          { n: "2", t: "Scan & register", d: "Enter your name and details on the badge page." },
          { n: "3", t: "Show your ID", d: "The badge now shows your conference profile." },
        ].map((s) => (
          <div key={s.n} className="surface p-4">
            <p className="font-display text-2xl font-bold text-primary">{s.n}</p>
            <p className="mt-1 font-display font-semibold">{s.t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Organiser?{" "}
        <Link to="/admin" className="font-semibold text-primary underline-offset-4 hover:underline">
          Open the admin dashboard
        </Link>{" "}
        to generate, download and print QR codes.
      </p>
    </main>
  );
}
