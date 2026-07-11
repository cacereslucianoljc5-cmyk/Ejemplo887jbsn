import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env y completala.`
    );
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const config = {
  botToken: required("TELEGRAM_BOT_TOKEN"),
  encryptionKey: required("WALLET_ENCRYPTION_KEY"),

  rpcUrl: optional("RPC_URL", "https://rpc.mainnet.chain.robinhood.com"),
  chainId: Number(optional("CHAIN_ID", "4663")),
  explorerUrl: optional("EXPLORER_URL", "https://robinhoodchain.blockscout.com"),

  hoodToken: required("HOOD_TOKEN_ADDRESS"),
  weth: required("WETH_ADDRESS"),
  router: required("UNISWAP_V2_ROUTER"),

  defaultSlippageBps: Number(optional("DEFAULT_SLIPPAGE_BPS", "100")),
  defaultBuyAmounts: optional("DEFAULT_BUY_AMOUNTS", "10,50,100,500")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  dataDir: optional("DATA_DIR", "./data"),
};
