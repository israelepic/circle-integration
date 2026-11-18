export type UsdcTransferStatus = "sent" | "paid" | "failed";

export function transferStatus(state: string | undefined): UsdcTransferStatus {
  if (state === "COMPLETE") return "paid";
  if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") return "failed";
  return "sent";
}
