"use client";

import type { PolicySafetyAssessment } from "@policykit/sdk";
import { Badge } from "@/components/ui/badge";

const LEVEL_COPY = {
  bounded: {
    label: "Bounded",
    variant: "success" as const,
    description: "All recommended caps and allowlists are enabled.",
  },
  "partially-bounded": {
    label: "Partially bounded",
    variant: "warn" as const,
    description: "Some recommended controls are open or unlimited.",
  },
  unbounded: {
    label: "Unbounded",
    variant: "danger" as const,
    description: "This configuration lacks a reliable monetary bound or is invalid.",
  },
};

export function PolicySafetySummary({
  assessment,
  compact = false,
}: {
  assessment: PolicySafetyAssessment;
  compact?: boolean;
}) {
  const copy = LEVEL_COPY[assessment.level];
  const actionable = assessment.findings.filter(
    (item) => item.severity !== "info"
  );

  return (
    <div
      className={`rounded-lg border p-3 ${
        assessment.level === "bounded"
          ? "border-mint-500/20 bg-mint-500/5"
          : assessment.level === "unbounded"
            ? "border-coral-500/30 bg-coral-500/5"
            : "border-amber-500/25 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-mist-200">Configuration safety</p>
        <Badge variant={copy.variant}>{copy.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-mist-400">{copy.description}</p>
      {!compact && actionable.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-mist-300">
          {actionable.map((item) => (
            <li key={item.code}>
              <span className="font-medium">{item.title}:</span>{" "}
              <span className="text-mist-400">{item.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-mist-500">
        Declared program intent is an allow/deny signal, not proof of downstream CPI.
      </p>
    </div>
  );
}
