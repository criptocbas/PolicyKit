"use client";

import { Connection, PublicKey } from "@solana/web3.js";
import { ActivityItem, ActivityKind } from "./activity";

/**
 * Best-effort parse of PolicyKit-related txs for a policy PDA.
 * No indexer required — uses getSignaturesForAddress + getTransaction logs.
 */
export async function fetchChainActivity(
  connection: Connection,
  policy: PublicKey,
  limit = 20
): Promise<ActivityItem[]> {
  try {
    const sigs = await connection.getSignaturesForAddress(policy, {
      limit,
    });
    const items: ActivityItem[] = [];

    for (const s of sigs) {
      let title = s.err ? "Transaction failed" : "On-chain transaction";
      let kind: ActivityKind = s.err ? "spend_fail" : "spend_ok";
      let success = !s.err;
      let detail: string | undefined;

      try {
        const tx = await connection.getTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        const logs = tx?.meta?.logMessages ?? [];
        const joined = logs.join("\n");

        if (joined.includes("SpendExecuted") || joined.includes("Instruction: ExecuteSpend")) {
          kind = s.err ? "spend_fail" : "spend_ok";
          title = s.err ? "Spend rejected" : "Spend executed";
        } else if (joined.includes("DepositReceived") || joined.includes("Instruction: Deposit")) {
          kind = "deposit";
          title = "Deposit";
          success = !s.err;
        } else if (joined.includes("ClawbackExecuted") || joined.includes("Instruction: Clawback")) {
          kind = "clawback";
          title = "Clawback";
          success = !s.err;
        } else if (joined.includes("PolicyPaused") || joined.includes("Instruction: PausePolicy")) {
          kind = "pause";
          title = "Policy paused";
        } else if (joined.includes("Instruction: UnpausePolicy")) {
          kind = "unpause";
          title = "Policy unpaused";
        } else if (joined.includes("Instruction: CreatePolicy")) {
          kind = "create";
          title = "Policy created";
        } else if (joined.includes("Instruction: UpdatePolicy")) {
          kind = "update";
          title = "Policy updated";
        } else if (joined.includes("Instruction: SetAgent")) {
          kind = "set_agent";
          title = "Agent rotated";
        }

        const errMatch = joined.match(/Error Code:\s*(\w+)/);
        if (errMatch) {
          success = false;
          kind = "spend_fail";
          title = errMatch[1];
          detail = "On-chain policy rejection";
        }
      } catch {
        /* keep defaults */
      }

      items.push({
        id: `chain-${s.signature}`,
        kind,
        title,
        detail: detail ?? (s.err ? "Failed on-chain" : "From chain history"),
        signature: s.signature,
        ts: s.blockTime ?? Math.floor(Date.now() / 1000),
        success,
        source: "chain",
      });
    }

    return items;
  } catch (e) {
    console.warn("fetchChainActivity failed", e);
    return [];
  }
}

/** Merge local + chain items; prefer chain row when signature matches. */
export function mergeActivity(
  local: ActivityItem[],
  chain: ActivityItem[]
): ActivityItem[] {
  const bySig = new Map<string, ActivityItem>();
  for (const item of local) {
    const key = item.signature ?? item.id;
    bySig.set(key, { ...item, source: item.source ?? "local" });
  }
  for (const item of chain) {
    if (item.signature) {
      bySig.set(item.signature, item);
    } else {
      bySig.set(item.id, item);
    }
  }
  return Array.from(bySig.values()).sort((a, b) => b.ts - a.ts).slice(0, 50);
}
