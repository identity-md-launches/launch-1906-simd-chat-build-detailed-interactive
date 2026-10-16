import type { Trade } from './model';
export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const DEFAULT_RPC = 'wss://solana-rpc.publicnode.com';
const DISCRIMINATOR = [189, 219, 127, 211, 78, 230, 97, 238];
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes: Uint8Array) {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let result = '';
  while (value > 0n) { result = ALPHABET[Number(value % 58n)] + result; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}
/** Decode the stable prefix of Pump's official TradeEvent. Only SOL amounts are supported.
 * https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json
 * No transaction signing, wallet access, or API credentials are used.
 */
export function decodeTrade(data: string, signature: string, index: number, solUsd: number): Trade | null {
  try {
    const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    if (raw.length < 129 || !DISCRIMINATOR.every((b, i) => raw[i] === b)) return null;
    const view = new DataView(raw.buffer);
    const solAmount = Number(view.getBigUint64(40, true)) / 1e9;
    const quantity = Number(view.getBigUint64(48, true)) / 1e6;
    const virtualSol = Number(view.getBigUint64(97, true)) / 1e9;
    const virtualTokens = Number(view.getBigUint64(105, true)) / 1e6;
    const timestamp = Number(view.getBigInt64(89, true)) * 1000;
    // Zero-SOL quotes (including USDC pairs) cannot be converted using the SOL rate.
    if (solAmount <= 0 || quantity <= 0 || virtualTokens <= 0 || virtualSol <= 0 || !Number.isFinite(solUsd) || solUsd <= 0 || raw[56] > 1) return null;
    const priceUsd = virtualSol / virtualTokens * solUsd;
    return { id: `${signature}:${index}`, mint: base58(raw.slice(8, 40)), wallet: base58(raw.slice(57, 89)),
      side: raw[56] ? 'buy' : 'sell', amountUsd: solAmount * solUsd, quantity, priceUsd,
      marketCap: priceUsd * 1e9, timestamp, platform: 'pump.fun', demo: false };
  } catch { return null; }
}
export interface MarketQuote { mint: string; price: number; change: number; marketCap: number; name: string; symbol: string }
interface Pair { chainId: string; baseToken: { address: string; name: string; symbol: string }; priceUsd?: string; marketCap?: number; liquidity?: { usd?: number }; priceChange?: { h24?: number } }
export async function fetchQuotes(mints: string[], signal?: AbortSignal): Promise<MarketQuote[]> {
  const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.slice(0, 30).join(',')}`, { signal });
  if (!response.ok) throw new Error(`Quotes unavailable (${response.status}).`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('The quote service returned an unexpected response.');
  const pairs = (data as Pair[]).filter(p => p.chainId === 'solana' && p.baseToken && mints.includes(p.baseToken.address) && Number(p.priceUsd) > 0);
  return mints.flatMap(mint => {
    const p = pairs.filter(p => p.baseToken.address === mint).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return p ? [{ mint, price: Number(p.priceUsd), change: p.priceChange?.h24 ?? 0, marketCap: p.marketCap ?? 0, name: p.baseToken.name, symbol: p.baseToken.symbol }] : [];
  });
}
export type Connection = 'connecting' | 'connected' | 'stale' | 'error';
export function connectLive(endpoint: string, getSolPrice: () => number | null, onTrade: (trade: Trade) => void, onStatus: (status: Connection, message: string) => void) {
  let socket: WebSocket;
  let closed = false;
  let lastEvent = Date.now();
  onStatus('connecting', 'Connecting to Solana…');
  try { socket = new WebSocket(endpoint); }
  catch { onStatus('error', 'Unable to open this endpoint. Check its address and retry.'); return () => {}; }
  const timeout = window.setTimeout(() => {
    if (!closed && socket.readyState !== WebSocket.OPEN) { onStatus('error', 'Connection timed out. Retry or use another read-only RPC.'); socket.close(); }
  }, 12000);
  const heartbeat = window.setInterval(() => {
    if (closed || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastEvent > 30000) onStatus('stale', 'No recent events. Reconnect to start a fresh session.');
  }, 10000);
  socket.onopen = () => {
    window.clearTimeout(timeout);
    socket.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'logsSubscribe', params: [{ mentions: [PUMP_PROGRAM] }, { commitment: 'confirmed' }] }));
  };
  socket.onmessage = e => {
    if (closed) return;
    try {
      const data = JSON.parse(e.data);
      if (data.error) { onStatus('error', 'The RPC rejected this subscription. Try another read-only endpoint.'); socket.close(); return; }
      if (data.id === 1 && typeof data.result === 'number') { lastEvent = Date.now(); onStatus('connected', 'Listening for confirmed pump.fun trades.'); return; }
      const value = data.params?.result?.value;
      if (!value || value.err || !Array.isArray(value.logs) || typeof value.signature !== 'string') return;
      lastEvent = Date.now();
      const solUsd = getSolPrice();
      if (!solUsd) { onStatus('stale', 'Waiting for a fresh SOL price to value trades in USD.'); return; }
      onStatus('connected', 'Receiving confirmed pump.fun trades.');
      // Attribute each data log to its executing program, preventing nested CPI log confusion.
      const stack: string[] = [];
      value.logs.forEach((line: unknown, i: number) => {
        if (typeof line !== 'string') return;
        const invoke = line.match(/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[/);
        if (invoke) stack.push(invoke[1]);
        else if (/^Program [1-9A-HJ-NP-Za-km-z]+ (success|failed:)/.test(line)) stack.pop();
        else if (stack.at(-1) === PUMP_PROGRAM && line.startsWith('Program data: ')) {
          const trade = decodeTrade(line.slice(14), value.signature, i, solUsd);
          if (trade) onTrade(trade);
        }
      });
    } catch { /* Invalid provider messages are ignored; the stale watchdog remains active. */ }
  };
  socket.onerror = () => { if (!closed) onStatus('error', 'The live stream is unavailable. Retry or change the read-only RPC.'); };
  socket.onclose = () => { if (!closed) onStatus('error', 'Live connection closed. Reconnect to start a fresh session.'); };
  return () => { closed = true; clearTimeout(timeout); clearInterval(heartbeat); socket.close(); };
}
export function validateEndpoint(value: string) {
  try { const url = new URL(value); return url.protocol === 'wss:' && !url.username && !url.password && !url.search && !url.hash; }
  catch { return false; }
}
