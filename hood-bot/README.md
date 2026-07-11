# 🤖 HOOD Bot — trading bot de Telegram para Robinhood Chain

Bot de Telegram **estilo Trojan** para operar en **Robinhood Chain** (la L2 de Robinhood sobre Ethereum, chain ID `4663`):

1. 💼 **Creás o importás una billetera** (auto-custodia, la clave queda cifrada en tu servidor).
2. 📥 **Le pegás el CA** (contract address) de cualquier token de la red.
3. 🟢 Te muestra botones con **cuántos HOOD querés gastar** (10 / 50 / 100 / 500, o monto custom) y ejecuta el swap por Uniswap.
4. 🔴 También podés **vender** el 25 / 50 / 100 % de tu posición de vuelta a HOOD.

## Cómo funciona el swap

- La compra hace `HOOD → token` (y la venta `token → HOOD`) cotizando **en paralelo por Uniswap V2 y V3** y ejecutando por la que da mejor precio:
  - **V2**: `swapExactTokensForTokensSupportingFeeOnTransferTokens` (ruta directa o vía WETH).
  - **V3**: `exactInputSingle` sobre `SwapRouter02`, probando los fee tiers 0.01/0.05/0.3/1 % (`QuoterV2` para cotizar). Muchos tokens de la red tienen liquidez **solo en V3**, así que esto es clave para poder comprarlos.
- Si pegás la dirección de un **pool** (lo que copiás de DEX Screener) en vez del token, el bot lo **resuelve al token subyacente** automáticamente.
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

### Nota sobre la moneda base (HOOD vs WETH)

En Robinhood Chain **no existe un token "HOOD" canónico**: hay decenas de memecoins con ese
símbolo, ninguno oficial, y Robinhood no tokenizó su propia acción en la red. El gas es **ETH**
y **todas las pools de Uniswap se cotizan contra WETH**. Por eso, igual que en Trojan (Solana)
gastás SOL —la moneda nativa—, acá lo funcional es usar **WETH** como moneda base
(`HOOD_TOKEN_ADDRESS` = dirección de WETH). Así el bot puede comprar cualquier CA que pegues,
ruteando `WETH → token` directo. Si querés usar un memecoin HOOD específico como moneda de
gasto, cambiá `HOOD_TOKEN_ADDRESS` por su CA (necesitará liquidez HOOD/WETH para rutear).

Direcciones ya verificadas en mainnet (chain 4663):

- **WETH / base** = `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- **UniswapV2Router02** = `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba`
  (validado on-chain: su `WETH()` y `factory()` coinciden con los docs de Uniswap)

## Uso

| Acción | Cómo |
| --- | --- |
| Menú principal | `/start` |
| Crear billetera | Botón "🆕 Crear billetera" (muestra la seed **una sola vez**) |
| Importar billetera | Botón "📥 Importar" y mandás la clave privada |
| Comprar un token | Pegás el CA en el chat → elegís cuántos HOOD gastar |
| Vender | Desde el panel del token: 25 % / 50 % / 100 % |
| Slippage y montos | Menú "⚙️ Ajustes" |

## Despliegue

El bot usa **long polling**: no necesita dominio, webhook ni puerto abierto — solo un proceso corriendo 24/7 con salida a internet.

### Opción A: cualquier VPS / tu PC

```bash
cd hood-bot
npm install
cp .env.example .env   # completar valores
npm start              # o con pm2: pm2 start src/index.js --name hood-bot
```

### Opción B: Fly.io (incluye `Dockerfile` + `fly.toml`)

```bash
cd hood-bot
fly launch --no-deploy --copy-config
fly volumes create hood_bot_data --size 1   # persiste las billeteras cifradas
fly secrets set \
  TELEGRAM_BOT_TOKEN=123456:ABC... \
  WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  HOOD_TOKEN_ADDRESS=0x... \
  WETH_ADDRESS=0x... \
  UNISWAP_V2_ROUTER=0x...
fly deploy
fly logs   # deberías ver "Bot conectado como @tu_bot"
```

⚠️ Guardá el `WALLET_ENCRYPTION_KEY` que generes: sin él no se pueden descifrar las billeteras guardadas.

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
