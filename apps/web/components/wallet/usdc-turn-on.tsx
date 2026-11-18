"use client";

import { Button } from "@lucel/ui/components/button";
import { useTransition } from "react";
import { toast } from "sonner";
import { usdc } from "@/content/usdc";
import { turnOnUsdc } from "@/lib/payouts/usdc-actions";

export function UsdcTurnOn() {
  const [pending, start] = useTransition();
  return (
    <Button
      className="mt-3"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await turnOnUsdc();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {usdc.turnOn}
    </Button>
  );
}
