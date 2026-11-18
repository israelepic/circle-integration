import { StatusRow, type StatusTone } from "@lucel/ui/components/status-row";
import { CircleDollarSign } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { usdc } from "@/content/usdc";
import { formatDate, formatMoney } from "@/lib/format";
import { getUsdcView } from "@/lib/payouts/usdc";
import { UsdcTurnOn } from "./usdc-turn-on";

const TONE: Record<string, StatusTone> = { queued: "progress", sent: "progress", paid: "done", failed: "problem" };

export async function UsdcPanel({ userId }: { userId: string }) {
  const v = await getUsdcView(userId);

  if (!v.on) {
    return (
      <Panel title={usdc.title} icon={<CircleDollarSign />}>
        <StatusRow tone="needs" title={usdc.off.title} detail={usdc.off.detail} />
        <UsdcTurnOn />
      </Panel>
    );
  }

  return (
    <Panel
      title={usdc.title}
      icon={<CircleDollarSign />}
      aside={
        <a href={v.addressUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-fg-muted">
          {usdc.wallet}
        </a>
      }
    >
      <p className="text-sm text-fg-muted">{usdc.balance}</p>
      <p className="display text-money">{v.balanceMinor === null ? usdc.balanceUnknown : formatMoney(v.balanceMinor, "USD", { kobo: true })}</p>
      {v.payouts.length === 0 ? (
        <p className="text-sm text-fg-muted">{usdc.empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {v.payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <StatusRow tone={TONE[p.status] ?? "progress"} title={formatMoney(p.amountMinor, "USD", { kobo: true, sign: true })} detail={`${usdc.status[p.status] ?? ""} · ${formatDate(new Date(p.at))}`} />
              {p.txUrl && (
                <a href={p.txUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-fg-muted">
                  {usdc.view}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
