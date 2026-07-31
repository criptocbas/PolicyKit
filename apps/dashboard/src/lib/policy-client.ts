"use client";

import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { PolicyKitClient } from "@policykit/sdk";
import { PROGRAM_ID } from "./config";

type AnchorWalletLike = {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T
  ) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>;
};

/** Anchor-compatible wallet adapter bridge. */
export function usePolicyKitClient(): {
  client: PolicyKitClient | null;
  connection: Connection;
  publicKey: PublicKey | null;
  connected: boolean;
} {
  const { connection } = useConnection();
  const wallet = useWallet();

  const client = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const signTransaction = wallet.signTransaction.bind(wallet);
    const signAllTransactions = wallet.signAllTransactions
      ? wallet.signAllTransactions.bind(wallet)
      : async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
          const out: T[] = [];
          for (const tx of txs) {
            out.push(await signTransaction(tx));
          }
          return out;
        };

    const anchorWallet: AnchorWalletLike = {
      publicKey: wallet.publicKey,
      signTransaction,
      signAllTransactions,
    };
    const provider = new AnchorProvider(
      connection,
      anchorWallet as AnchorProvider["wallet"],
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );
    return new PolicyKitClient(provider, PROGRAM_ID);
  }, [connection, wallet]);

  return {
    client,
    connection,
    publicKey: wallet.publicKey,
    connected: wallet.connected,
  };
}
