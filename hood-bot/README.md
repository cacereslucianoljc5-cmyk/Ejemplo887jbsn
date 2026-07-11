# 🤖 HOOD Bot — trading bot de Telegram para Robinhood Chain

Bot de Telegram **estilo Trojan** para operar en **Robinhood Chain** (la L2 de Robinhood sobre Ethereum, chain ID `4663`):

1. 💼 **Creás o importás una billetera** (auto-custodia, la clave queda cifrada en tu servidor).
2. 📥 **Le pegás el CA** (contract address) de cualquier token de la red.
3. 🟢 Te muestra botones con **cuántos HOOD querés gastar** (10 / 50 / 100 / 500, o monto custom) y ejecuta el swap por Uniswap.
4. 🔴 También podés **vender** el 25 / 50 / 100 % de tu posición de vuelta a HOOD.

## Cómo funciona el swap

- La compra hace `HOOD → token` (y la venta `token → HOOD`) usando un router **estilo Uniswap V2** (`swapExactTokensForTokensSupportingFeeOnTransferTokens`), probando la ruta directa y la ruta vía WETH, y eligiendo la que da mejor precio.
- Protección de **slippage** configurable por usuario (default 1 %).
- El **gas de Robinhood Chain se paga en ETH**, así que la billetera necesita un poco de ETH además de los HOOD.

## Requisitos

- Node.js ≥ 20
- Un bot de Telegram creado con [@BotFather](https://t.me/BotFather)

## Instalación

```bash
cd hood-bot
npm install
cp .env.example .env
# editá .env con tus valores
npm start
```

## Configuración (`.env`)

| Variable | Descripción |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token de @BotFather |
| `WALLET_ENCRYPTION_KEY` | Clave maestra para cifrar las claves privadas (`openssl rand -hex 32`) |
| `RPC_URL` | RPC de Robinhood Chain (default: `https://rpc.mainnet.chain.robinhood.com`) |
| `CHAIN_ID` | `4663` |
| `HOOD_TOKEN_ADDRESS` | CA del token HOOD que se usa para comprar |
| `WETH_ADDRESS` | CA de WETH en Robinhood Chain |
| `UNISWAP_V2_ROUTER` | Router V2 de Uniswap en Robinhood Chain |
| `DEFAULT_SLIPPAGE_BPS` | Slippage default en puntos básicos (100 = 1 %) |
| `DEFAULT_BUY_AMOUNTS` | Botones de compra default, en HOOD |

### ¿De dónde saco las direcciones de contratos?

Robinhood Chain es una red muy nueva, así que **verificá siempre las direcciones vos mismo**:

- Explorador oficial (Blockscout): busca `WETH`, el token `HOOD` y `UniswapV2Router02` **verificados**.
- Docs oficiales: <https://docs.robinhood.com/chain/contracts/>
- Deployments de Uniswap: <https://docs.uniswap.org/contracts/v2/reference/smart-contracts/v2-deployments>
- Podés cruzar el CA de HOOD con DEX Screener (red "robinhood").

⚠️ No copies direcciones de mensajes de Telegram/Twitter: es el vector de scam más común.

## Uso

| Acción | Cómo |
| --- | --- |
| Menú principal | `/start` |
| Crear billetera | Botón "🆕 Crear billetera" (muestra la seed **una sola vez**) |
| Importar billetera | Botón "📥 Importar" y mandás la clave privada |
| Comprar un token | Pegás el CA en el chat → elegís cuántos HOOD gastar |
| Vender | Desde el panel del token: 25 % / 50 % / 100 % |
| Slippage y montos | Menú "⚙️ Ajustes" |

## Seguridad

- Las claves privadas se guardan **cifradas con AES-256-GCM** (clave derivada con scrypt desde `WALLET_ENCRYPTION_KEY`) en `data/store.json`.
- La seed de las billeteras nuevas **no se guarda**: se muestra una vez y listo.
- Este bot es **para hostearlo vos mismo**. No importes tu clave privada en instancias de terceros.
- `data/` y `.env` están en `.gitignore`: nunca los subas al repo.
- Los approvals al router son ilimitados (patrón estándar de estos bots); si preferís, revocalos periódicamente desde el explorador.

## Estructura

```
hood-bot/
├── src/
│   ├── index.js    # bot de Telegram: menús, comandos, compra/venta
│   ├── ui.js       # textos y teclados inline
│   ├── chain.js    # provider, cotizaciones, swaps (router V2)
│   ├── wallet.js   # crear/importar billeteras, cifrado AES-256-GCM
│   ├── storage.js  # persistencia JSON por usuario
│   └── config.js   # carga y validación del .env
└── scripts/smoke.js
```
