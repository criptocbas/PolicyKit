export {
  POLICYKIT_PROGRAM_ID,
  POLICY_SEED,
  SECONDS_PER_DAY,
  MAX_PROGRAM_LIST,
  MAX_MINT_LIST,
  MAX_DESTINATION_LIST,
  KNOWN_PROGRAMS,
} from "./constants";

export {
  findPolicyPda,
  findVaultAta,
  policyIdToSeed,
  toPolicyIdBn,
  type PolicyIdInput,
} from "./pda";

export {
  POLICYKIT_ERROR_CODES,
  POLICYKIT_ERROR_MESSAGES,
  POLICYKIT_ERROR_TITLES,
  PolicyKitError,
  mapPolicyKitError,
  toPolicyKitError,
  type PolicyKitErrorName,
  type PolicyKitErrorInfo,
} from "./errors";

export type {
  CreatePolicyParams,
  UpdatePolicyParams,
  PolicyAccount,
  PolicyStatus,
  ExecuteSpendArgs,
  DepositArgs,
  ClawbackArgs,
} from "./types";

export {
  remainingDaily,
  remainingActions,
  isActive,
  isExpired,
  refreshPolicyWindows,
  buildPolicyStatus,
  previewSpend,
  toBn,
} from "./helpers";

export { computeMaxDamage, type MaxDamageReport } from "./max-damage";

export {
  assessFreshness,
  formatRelativeAge,
  freshnessBadgeVariant,
  parseLiveFeed,
  FRESHNESS_MS,
  type Freshness,
  type FreshnessLevel,
  type LiveFeedPayload,
} from "./feed-freshness";

export {
  POLICY_TEMPLATES,
  conservativeTradingTemplate,
  x402PaymentsTemplate,
  researchLimitedSpendTemplate,
  type TemplateContext,
  type PolicyTemplateName,
} from "./templates";

export { PolicyKitClient } from "./client";

export type { Policykit } from "./idl-types";
