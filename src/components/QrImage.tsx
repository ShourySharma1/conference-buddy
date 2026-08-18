import { useEffect, useState } from "react";
import { qrDataUrl } from "@/lib/qr";

export function QrImage({
  code,
  size = 220,
  className,
}: {
  code: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    qrDataUrl(code, Math.max(size * 2, 320)).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code, size]);

  return (
    <div
      className={`overflow-hidden rounded-lg bg-white ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={`QR code for badge ${code}`} width={size} height={size} />
      ) : null}
    </div>
  );
}
