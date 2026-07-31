import { MaxDamageReport } from "@policykit/sdk";
import { toUiAmount } from "./format";
import BN from "bn.js";

function uiOrInf(v: BN | null): string {
  if (v === null) return "∞";
  return toUiAmount(v);
}

export function formatMaxDamageLines(m: MaxDamageReport): string[] {
  return [
    `Max per action: ${uiOrInf(m.maxPerAction)} tokens`,
    `Max this rate window: ${uiOrInf(m.maxPerRateWindow)} tokens`,
    `Remaining today: ${uiOrInf(m.remainingDaily)} tokens`,
    m.destinationOwners
      ? `Can pay only ${m.destinationOwners.length} allowlisted owner(s)`
      : "Can pay any destination owner (open)",
    m.intentPrograms
      ? `Intent programs: ${m.intentPrograms.length} allowlisted`
      : "Program allowlist off",
    "Authority can pause (circuit breaker) and clawback anytime",
  ];
}
