import { CLUSTER, ClusterName } from "./config";

export function solscanTx(signature: string, cluster: ClusterName = CLUSTER): string {
  if (cluster === "localnet") {
    return `https://explorer.solana.com/tx/${signature}?cluster=custom`;
  }
  if (cluster === "mainnet-beta") {
    return `https://solscan.io/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}?cluster=${cluster}`;
}

export function solscanAddress(
  address: string,
  cluster: ClusterName = CLUSTER
): string {
  if (cluster === "localnet") {
    return `https://explorer.solana.com/address/${address}?cluster=custom`;
  }
  if (cluster === "mainnet-beta") {
    return `https://solscan.io/account/${address}`;
  }
  return `https://solscan.io/account/${address}?cluster=${cluster}`;
}
