/** Minimal stubs so @solana/wallet-adapter-react builds without mobile adapter. */

export const SolanaMobileWalletAdapterWalletName = "Solana Mobile Wallet" as const;

export class SolanaMobileWalletAdapter {
  name = SolanaMobileWalletAdapterWalletName;
  url = "";
  icon = "";
  readyState = "Unsupported" as const;
  publicKey = null;
  connecting = false;
  connected = false;
  supportedTransactionVersions = null;
  async connect() {
    throw new Error("Mobile wallet adapter not available in this build");
  }
  async disconnect() {}
  async signTransaction() {
    throw new Error("Mobile wallet adapter not available");
  }
  async signAllTransactions() {
    throw new Error("Mobile wallet adapter not available");
  }
  async signMessage() {
    throw new Error("Mobile wallet adapter not available");
  }
  async sendTransaction() {
    throw new Error("Mobile wallet adapter not available");
  }
  on() {
    return this;
  }
  off() {
    return this;
  }
  emit() {
    return false;
  }
}

export function createDefaultAddressSelector() {
  return async () => {
    throw new Error("Mobile wallet not available");
  };
}

export function createDefaultAuthorizationResultCache() {
  return {
    async clear() {},
    async get() {
      return undefined;
    },
    async set() {},
  };
}

export function createDefaultWalletNotFoundHandler() {
  return async () => {};
}
