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

  // Uniswap V3 en Robinhood Chain (defaults verificados on-chain: su factory()
  // coincide con la del pool de tokens reales). Muchos tokens tienen liquidez
  // solo en V3, así que el bot cotiza por V2 y V3 y elige el mejor precio.
  v3Router: optional("UNISWAP_V3_ROUTER", "0xCaf681a66D020601342297493863E78C959E5cb2"),
  v3Quoter: optional("UNISWAP_V3_QUOTER", "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7"),
  v3Factory: optional("UNISWAP_V3_FACTORY", "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA"),
  v3FeeTiers: optional("UNISWAP_V3_FEE_TIERS", "100,500,3000,10000")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0),

  defaultSlippageBps: Number(optional("DEFAULT_SLIPPAGE_BPS", "100")),
  defaultBuyAmounts: optional("DEFAULT_BUY_AMOUNTS", "10,50,100,500")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  dataDir: optional("DATA_DIR", "./data"),
};
