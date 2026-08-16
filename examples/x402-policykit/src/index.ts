import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  KNOWN_PROGRAMS,
  POLICYKIT_X402_SCHEME,
  PolicyKitClient,
  SOLANA_CAIP2,
  createPolicyKitX402PaymentHeader,
  encodeX402PaymentRequired,
  validatePolicyKitX402Payment,
  type X402PaymentRequired,
} from "@policykit/sdk";

const ROOT = path.join(__dirname, "..", "..", "..");
const CONFIG_PATH =
  process.env.LIVE_CONFIG ?? path.join(ROOT, "proof", "live-config.json");
const AGENT_KEY =
  process.env.AGENT_KEY ?? path.join(ROOT, "proof", ".agent-keypair.json");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PORT = Number(process.env.PORT ?? 3402);
const PRICE = new BN(process.env.X402_PRICE ?? "1000000");
const MAX_PRICE = new BN(process.env.X402_MAX_PRICE ?? "2000000");

function loadAgent(filePath: string): Keypair {
  const bytes = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function decodeHeader<T>(header: string): T {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8")) as T;
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH) || !fs.existsSync(AGENT_KEY)) {
    throw new Error(
      "Missing live config or demo agent key. Run `yarn agent:setup` from the repository root."
    );
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as {
    cluster: string;
    policy: string;
    programId: string;
    spendMint: string;
    agent: string;
  };
  if (config.cluster !== "devnet") {
    throw new Error(
      "This example is intentionally restricted to Solana devnet."
    );
  }

  const agent = loadAgent(AGENT_KEY);
  if (agent.publicKey.toBase58() !== config.agent) {
    throw new Error("Demo agent key does not match live-config.agent.");
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const policy = new PublicKey(config.policy);
  const programId = new PublicKey(config.programId);
  const asset = new PublicKey(config.spendMint);
  const payTo = new PublicKey(process.env.X402_PAY_TO ?? config.agent);
  const intentProgram = new PublicKey(
    process.env.X402_INTENT_PROGRAM ?? KNOWN_PROGRAMS.JUPITER_V6.toBase58()
  );
  const payToToken = getAssociatedTokenAddressSync(asset, payTo, true);
  if (!(await connection.getAccountInfo(payToToken))) {
    throw new Error(
      `Recipient ATA ${payToToken.toBase58()} does not exist. Create it before running the example.`
    );
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 120;
  const quoteId = randomUUID();
  const resourceUrl = `http://127.0.0.1:${PORT}/research`;
  const paymentRequired: X402PaymentRequired = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: resourceUrl,
      description: "PolicyKit bounded research result",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: POLICYKIT_X402_SCHEME,
        network: SOLANA_CAIP2.devnet,
        amount: PRICE.toString(),
        asset: asset.toBase58(),
        payTo: payTo.toBase58(),
        maxTimeoutSeconds: 120,
        extra: {
          intentProgram: intentProgram.toBase58(),
          policy: policy.toBase58(),
          quoteId,
          issuedAt,
          expiresAt,
        },
      },
    ],
    extensions: {},
  };
  const requiredHeader = encodeX402PaymentRequired(paymentRequired);
  const consumedSignatures = new Set<string>();

  const server = createServer(async (request, response) => {
    try {
      if (request.url !== "/research") {
        response.writeHead(404).end();
        return;
      }
      const paymentHeader = request.headers["payment-signature"];
      if (typeof paymentHeader !== "string") {
        response.writeHead(402, {
          "content-type": "application/json",
          "payment-required": requiredHeader,
        });
        response.end(JSON.stringify({ error: "Payment required" }));
        return;
      }

      const payload = decodeHeader<{
        x402Version: number;
        accepted: X402PaymentRequired["accepts"][number];
        payload: { signature: string; policy: string };
      }>(paymentHeader);
      const signature = payload.payload?.signature;
      if (
        payload.x402Version !== 2 ||
        payload.accepted?.extra?.quoteId !== quoteId ||
        payload.payload?.policy !== policy.toBase58() ||
        typeof signature !== "string" ||
        consumedSignatures.has(signature) ||
        Math.floor(Date.now() / 1000) > expiresAt
      ) {
        response
          .writeHead(402)
          .end(JSON.stringify({ error: "Invalid or expired payment" }));
        return;
      }

      const verified = await verifySettlement({
        connection,
        signature,
        programId,
        asset,
        payTo,
        amount: PRICE,
        issuedAt,
        expiresAt,
      });
      if (!verified) {
        response
          .writeHead(402)
          .end(JSON.stringify({ error: "Payment verification failed" }));
        return;
      }
      consumedSignatures.add(signature);
      response.writeHead(200, {
        "content-type": "application/json",
        "payment-response": Buffer.from(
          JSON.stringify({
            success: true,
            transaction: signature,
            network: SOLANA_CAIP2.devnet,
          })
        ).toString("base64"),
      });
      response.end(
        JSON.stringify({
          result: "Professional x402 integration: payment verified.",
          policy: policy.toBase58(),
          signature,
        })
      );
    } catch (error) {
      response.writeHead(500).end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal error",
        })
      );
    }
  });

  await new Promise<void>((resolve) =>
    server.listen(PORT, "127.0.0.1", resolve)
  );
  try {
    console.log(`x402 resource listening at ${resourceUrl}`);
    const initial = await fetch(resourceUrl);
    if (initial.status !== 402)
      throw new Error(`Expected HTTP 402, got ${initial.status}`);

    const validated = validatePolicyKitX402Payment(
      initial.headers.get("payment-required"),
      {
        network: SOLANA_CAIP2.devnet,
        asset,
        maxAmount: MAX_PRICE,
        allowedPayTo: [payTo],
        intentProgram,
        maxTimeoutSeconds: 120,
      }
    );

    const sdk = new PolicyKitClient(
      new AnchorProvider(connection, new Wallet(agent), {
        commitment: "confirmed",
      }),
      programId
    );
    const signature = await sdk.executeSpend({
      policy,
      mint: asset,
      amount: validated.amount,
      intentProgram: validated.intentProgram,
      destination: payToToken,
      agent: agent.publicKey,
    });
    const paymentSignature = createPolicyKitX402PaymentHeader({
      validated,
      signature,
      policy,
    });
    const paid = await fetch(resourceUrl, {
      headers: { "payment-signature": paymentSignature },
    });
    if (!paid.ok) {
      throw new Error(
        `Paid request failed (${paid.status}): ${await paid.text()}`
      );
    }
    console.log(await paid.text());
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function verifySettlement(args: {
  connection: Connection;
  signature: string;
  programId: PublicKey;
  asset: PublicKey;
  payTo: PublicKey;
  amount: BN;
  issuedAt: number;
  expiresAt: number;
}): Promise<boolean> {
  const transaction = await args.connection.getParsedTransaction(
    args.signature,
    {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    }
  );
  if (!transaction || transaction.meta?.err) return false;
  const blockTime = transaction.blockTime;
  if (
    blockTime === null ||
    blockTime < args.issuedAt - 5 ||
    blockTime > args.expiresAt
  ) {
    return false;
  }
  const logs = transaction.meta?.logMessages ?? [];
  if (
    !logs.some((line) =>
      line.includes(`Program ${args.programId.toBase58()} invoke`)
    ) ||
    !logs.some((line) => line.includes("Instruction: ExecuteSpend"))
  ) {
    return false;
  }

  const before = tokenAmountFor(
    transaction.meta?.preTokenBalances ?? [],
    args.asset,
    args.payTo
  );
  const after = tokenAmountFor(
    transaction.meta?.postTokenBalances ?? [],
    args.asset,
    args.payTo
  );
  return after.sub(before).eq(args.amount);
}

function tokenAmountFor(
  balances: readonly {
    mint: string;
    owner?: string;
    uiTokenAmount: { amount: string };
  }[],
  mint: PublicKey,
  owner: PublicKey
): BN {
  const balance = balances.find(
    (item) => item.mint === mint.toBase58() && item.owner === owner.toBase58()
  );
  return new BN(balance?.uiTokenAmount.amount ?? "0");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
