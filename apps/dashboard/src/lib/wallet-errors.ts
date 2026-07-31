/**
 * Normalize wallet / Anchor / PolicyKit errors for toast UX.
 * User cancelling the wallet popup is expected — never show a raw stack.
 */

export function isWalletApprovalDenied(err: unknown): boolean {
  if (err == null) return false;
  const msg = collectMessage(err).toLowerCase();
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name?: string }).name)
      : "";

  // Phantom / wallet-standard often use these names with a short "Approval Denied" message.
  if (
    name === "WalletSendTransactionError" ||
    name === "WalletSignTransactionError" ||
    name === "WalletNotConnectedError" ||
    name === "WalletSignMessageError"
  ) {
    if (
      msg.includes("approval") ||
      msg.includes("reject") ||
      msg.includes("denied") ||
      msg.includes("cancel") ||
      msg.includes("user") ||
      msg.trim() === "" // some wallets throw named errors with empty message
    ) {
      return true;
    }
  }

  return (
    msg.includes("approval denied") ||
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("transaction cancelled") ||
    msg.includes("transaction canceled") ||
    msg.includes("request rejected") ||
    // Bare Phantom / standard adapter text
    msg.trim() === "approval denied"
  );
}

export function friendlyErrorMessage(err: unknown): string {
  if (isWalletApprovalDenied(err)) {
    return "Transaction cancelled in wallet — nothing was sent.";
  }

  if (err instanceof Error) {
    // Strip noisy WalletSendTransactionError prefixes when possible
    const m = err.message.trim();
    if (m.length > 0 && m.length < 280 && !m.includes("at StandardWallet")) {
      return m;
    }
    if (m.includes("Approval Denied") || m.includes("approval denied")) {
      return "Transaction cancelled in wallet — nothing was sent.";
    }
  }

  return collectMessage(err) || "Something went wrong";
}

function collectMessage(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const cause =
      "cause" in err && err.cause != null ? collectMessage(err.cause) : "";
    return [err.message, cause].filter(Boolean).join(" ");
  }
  if (typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
