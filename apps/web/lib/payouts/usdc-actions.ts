"use server";

import { revalidatePath } from "next/cache";
import { usdc } from "@/content/usdc";
import { authorize } from "@/lib/authz";
import { primeCircle } from "@/lib/circle/client";
import { withUser } from "@/lib/db";
import { ensureUsdcWallet } from "./usdc";

export type UsdcActionState = { ok: boolean; message: string };

export async function turnOnUsdc(): Promise<UsdcActionState> {
  const { session } = await authorize("creator:act");
  const creatorId = await withUser(session.user.id, async (db) => (await db.query<{ id: string | null }>("select private.current_creator_id() as id")).rows[0]?.id ?? null);
  if (!creatorId) return { ok: false, message: usdc.errors.generic };
  try {
    await primeCircle();
    await ensureUsdcWallet(creatorId);
  } catch {
    return { ok: false, message: usdc.errors.generic };
  }
  revalidatePath("/c/wallet");
  return { ok: true, message: usdc.turnedOn };
}
