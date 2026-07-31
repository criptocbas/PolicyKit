import { CLUSTER, RPC_URL, type ClusterName } from "./config";

/** Wallet network switch hint for operators. */
export function walletClusterHint(cluster: ClusterName = CLUSTER): string {
  if (cluster === "localnet") {
    return "Point your wallet custom RPC at localnet (e.g. http://127.0.0.1:8899).";
  }
  if (cluster === "mainnet-beta") {
    return "Switch Phantom/Solflare network to Mainnet.";
  }
  return "Switch Phantom/Solflare network to Devnet (not Mainnet).";
}

/** When a policy account cannot be loaded on the configured RPC. */
export function policyLoadErrorCopy(
  err: unknown,
  cluster: ClusterName = CLUSTER
): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("account does not exist") ||
    lower.includes("could not find account") ||
    lower.includes("account not found") ||
    lower.includes("has no data")
  ) {
    return `No PolicyKit account at this address on ${cluster}. Use a policy created on ${cluster}, or check the program id / RPC.`;
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("429") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused")
  ) {
    return `RPC unreachable (${shortRpc(RPC_URL)}). Check network or set NEXT_PUBLIC_RPC_URL.`;
  }

  if (lower.includes("invalid") && lower.includes("publickey")) {
    return "Invalid policy address (need a base58 Solana pubkey).";
  }

  // Generic but actionable — cluster mismatch is the #1 demo failure
  return (
    raw ||
    `Could not load policy on ${cluster}. ${walletClusterHint(cluster)} Confirm the address was created with this program on this cluster.`
  );
}

export function shortRpc(url: string = RPC_URL): string {
  return url.replace(/^https?:\/\//, "").slice(0, 48);
}

export function connectWalletBanner(cluster: ClusterName = CLUSTER): string {
  return `Connect Phantom or Solflare on ${cluster}. ${walletClusterHint(cluster)} Wrong network looks like “account not found.”`;
}
