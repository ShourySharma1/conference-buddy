import { QrImage } from "./QrImage";

export type BadgeCardData = {
  serial: number;
  code: string;
  fullName?: string | null;
  organization?: string | null;
  designation?: string | null;
  ticketType?: string | null;
};

export function BadgeIdCard({
  badge,
  compact = false,
  printable = false,
}: {
  badge: BadgeCardData;
  compact?: boolean;
  printable?: boolean;
}) {
  const serial = String(badge.serial).padStart(4, "0");

  return (
    <article
      className={`badge-card ${printable ? "print-badge" : ""} flex flex-col gap-4 p-5`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="label-xs">Conference Pass</p>
          <p className="font-display text-lg font-bold tracking-tight">ID · {serial}</p>
        </div>
        <span className="label-xs rounded-full border border-border px-2 py-1">
          {badge.ticketType ?? "attendee"}
        </span>
      </header>

      <div className="flex items-center gap-4">
        <QrImage code={badge.code} size={compact ? 108 : 148} />
        <div className="min-w-0">
          <p className="label-xs">Name</p>
          <p className="truncate font-display text-xl font-bold">
            {badge.fullName ?? "Unclaimed"}
          </p>
          {badge.designation ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">{badge.designation}</p>
          ) : null}
          {badge.organization ? (
            <p className="truncate text-sm text-muted-foreground">{badge.organization}</p>
          ) : null}
          {!badge.fullName ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Scan this code to add your details.
            </p>
          ) : null}
        </div>
      </div>

      <footer className="border-t border-border pt-3">
        <p className="font-mono text-[0.7rem] break-all text-muted-foreground">{badge.code}</p>
      </footer>
    </article>
  );
}
