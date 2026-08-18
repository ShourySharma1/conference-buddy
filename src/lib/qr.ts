import QRCode from "qrcode";

/** The URL that a scanner opens. Keep this in one place so it is easy to change. */
export function badgeUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/b/${encodeURIComponent(code)}`;
}

export async function qrDataUrl(code: string, size = 512): Promise<string> {
  return QRCode.toDataURL(badgeUrl(code), {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0d1420", light: "#ffffff" },
  });
}

export async function qrPngBlob(code: string, size = 700): Promise<Blob> {
  const dataUrl = await qrDataUrl(code, size);
  const res = await fetch(dataUrl);
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadQrZip(
  badges: { serial: number; token: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i]!;
    const dataUrl = await qrDataUrl(badge.token, 700);
    zip.file(
      `badge-${String(badge.serial).padStart(4, "0")}.png`,
      dataUrl.split(",")[1]!,
      { base64: true },
    );
    onProgress?.(i + 1, badges.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "conference-qr-codes.zip");
}
