# Pulse · Solana wallet tracker

Pulse is a responsive, read-only dashboard for following Solana memecoin buyers. It includes custom market-cap filters, a $50–$500 buy range, an eight-position tracking list, automatic replacement after an observed sell, holding times, unrealized returns, contract copying, session history, token quotes, and CSV export.

The finished static site is in **`dist/`**. It includes all fonts, token images, scripts, styles, the favicon, and the share image. Vite uses `base: './'`; navigation uses hashes, so the export works under a static gateway subpath without rewrite rules.

## Install, develop, and rebuild

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

For the production export and local preview:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The preview command prints its local URL. Serve `dist/` with any static HTTP server; opening the HTML with `file://` is not supported. Clipboard access requires HTTPS or a local secure context; a selectable full-address fallback is provided when access is denied.

`npm run build` recreates `dist/`. Keep the complete export alongside the source and `package-lock.json`. Generated dependencies, package caches, and browser installations are not delivery assets. No ignore file was changed for this assignment. During implementation, dependencies were installed in a temporary build directory outside the repository, and the resulting production export was copied back.

## Use the tracker

1. Start in the labeled **Demo session**, which uses simulated trades and valuations with public token identifiers. Demo wallet names are deliberately fictional, not invented blockchain addresses.
2. Edit the minimum and maximum market cap and buy size, then select **Apply filters**. Buy sizes must remain within $50–$500. On phones, **Edit filters** opens the controls.
3. Search wallets or token names, sort positions, or open a row for its full address and price history. The copy icon copies the entire token contract address.
4. The tracker retains up to eight qualifying wallet/token positions. Additional eligible buyers enter a queue. Any observed sell, including a partial sell, removes that position and promotes a queued buyer if one exists.
5. **Use live data** starts a fresh live session. **Data settings** accepts a secure, browser-safe, read-only Solana WebSocket endpoint. **Token watch** displays actual DEX Screener prices independently of the demo.

Filters persist in this browser's local storage. Trades, history, and RPC settings live only in the current tab. Reloading or switching data modes starts a fresh session. Pausing freezes the tracker; resuming live tracking starts fresh because sales may have occurred during the gap. Live disconnects never silently switch to demo data.

## Data sources and limits

- **Live events:** confirmed `logsSubscribe` messages for the official pump.fun program. The default endpoint is [PublicNode's Solana RPC](https://solana.publicnode.com/). The decoder follows the stable prefix of the [official Pump TradeEvent IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json). Failed transactions, malformed events, nested logs from other programs, zero-SOL quote events, and duplicate signatures/log indices are rejected.
- **Live USD conversion and market watch:** [DEX Screener's token endpoint](https://docs.dexscreener.com/api/reference), polled every 30 seconds. SOL quotes older than 90 seconds are not used to admit new live trades. Quote errors retain the previous response with an explicit warning and timestamp.
- **Scope:** live tracking covers SOL-paired pump.fun bonding curves. Other launchpads, USDC-paired tokens, transfers, and trades after migration to other programs are not observed. The demo includes a Launchpad category to exercise filtering; it is not a claim of another live connector.
- **Valuations:** live prices use virtual SOL/token reserves and six token decimals. Market caps are explicitly estimates assuming a standard 1 billion token supply. Nonstandard supplies can produce inaccurate cap filtering. Unrealized returns use observed purchase cost and quantity, exclude fees/slippage, and are not a complete wallet balance or realized P/L. Holdings before the session are unknown.
- **Replacement:** a slot remains empty if no qualifying queued buyer exists. Repeated observed buys aggregate cost and quantity; a position that moves outside the filter range is replaced by another eligible candidate. The candidate pool retains at most 200 positions, history 80 events, price trends 24 samples, and deduplication 2,000 recent event identifiers.
- **Availability:** public RPCs and quote services can reject, delay, rate-limit, or interrupt requests. Thirty seconds without transaction notifications displays a delayed-data state. Reconnection clears old positions. This browser-only export has no durable indexer, historical backfill, or guaranteed complete feed.

No wallet connection, signing flow, trading credentials, backend, or private key is needed or included. Do not enter a private credential in the endpoint field. A production operator can configure a public, browser-safe read-only RPC proxy when a public provider is unsuitable.

## Validation performed

The final source was typechecked and built with the locked dependencies. Actual worker results:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, no TypeScript errors |
| `npm run build` | Passed; production export uses relative asset URLs |
| `npm test` | 9 tests passed, including a captured public mainnet TradeEvent |
| Chromium production interaction suite | 24 checks passed, no application exceptions or missing local resources |
| Pinned `taste@1` probe | 16 of 16 checks passed |
| Responsive production export | Checked at 320, 390, 768, 1024, and 1440 CSS pixels |
| Public data checks | Real market quotes rendered; public WebSocket subscription accepted; a separate browser check received a transaction-log notification |
| WebKit | Could not launch in the available runtime; behavior unverified |

The interaction suite uses deterministic quote and WebSocket fixtures to test filter bounds and persistence, empty recovery, searching, sorting, full-address clipboard copying, dialog focus restoration, CSV content, timed demo replacement, live-format buy/sell replacement, disconnect/reconnect handling, endpoint validation, mobile filters, keyboard dialog behavior, and reduced motion. Separate unmocked requests distinguish provider availability from fixture coverage. A short unmocked suite window received no transaction notifications; a subsequent longer browser check did receive one. Sustained event completeness and a real tracked wallet's eventual sale were not verified.

Run the reusable browser suite after building:

```sh
npx playwright install chromium webkit
npm run test:browser
```

It serves the actual `dist/` under `/preview/`, owns and closes its HTTP server and browsers, and writes disposable evidence under `test/scratch/browser-validation/`. WebKit unavailability is reported as unperformed. Its launch catch does not claim a WebKit pass.

During the assignment the pinned probe was run from the repository root:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

An explicitly selected Playwright module and browser installation outside the repository were supplied to the probe. This bypassed its optional home-directory discovery. The pinned input is removed from the submission; its measured results are retained in `artifacts/design-probe.json`.

See [the validation report](artifacts/validation.md), [the implemented design system](DESIGN.md), and [third-party notices](THIRD_PARTY_NOTICES.md). These are worker observations, not independent certification. Native screen-reader sessions, physical devices, native 200% browser zoom, and sustained provider-load testing were not performed.
