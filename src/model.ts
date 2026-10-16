export type Platform = 'pump.fun' | 'Launchpad';
export type FeedMode = 'demo' | 'live';
export interface Token {
  mint: string; name: string; symbol: string; platform: Platform;
  priceUsd: number; marketCap: number; history: number[]; updatedAt: number;
  image?: string; estimated?: boolean;
}
export interface Position {
  id: string; wallet: string; mint: string; amountUsd: number; quantity: number;
  boughtAt: number; demo: boolean;
}
export interface Trade {
  id: string; wallet: string; mint: string; side: 'buy' | 'sell';
  amountUsd: number; quantity: number; priceUsd: number; marketCap: number;
  timestamp: number; platform: Platform; demo: boolean;
}
export interface Activity {
  id: string; type: 'buy' | 'sell' | 'replace'; wallet: string; mint: string;
  amountUsd: number; timestamp: number; demo: boolean;
}
export interface Filters { minCap: number; maxCap: number; minBuy: number; maxBuy: number; platform: 'all' | Platform }
export interface TrackerState {
  positions: Position[]; activeIds: string[]; tokens: Record<string, Token>; events: Activity[];
  replacements: number; seen: string[]; received: number;
}
export const DEFAULT_FILTERS: Filters = { minCap: 10000, maxCap: 1000000, minBuy: 50, maxBuy: 500, platform: 'all' };
export const MAX_ACTIVE = 8;
export const emptyState = (): TrackerState => ({ positions: [], activeIds: [], tokens: {}, events: [], replacements: 0, seen: [], received: 0 });
export const positionId = (wallet: string, mint: string) => `${wallet}:${mint}`;
export function qualifies(p: Position, token: Token | undefined, f: Filters) {
  return !!token && token.marketCap >= f.minCap && token.marketCap <= f.maxCap &&
    p.amountUsd >= f.minBuy && p.amountUsd <= f.maxBuy && (f.platform === 'all' || token.platform === f.platform);
}
export function reconcile(state: TrackerState, filters: Filters): TrackerState {
  const eligible = state.positions.filter(p => qualifies(p, state.tokens[p.mint], filters));
  const ids = new Set(eligible.map(p => p.id));
  const retained = state.activeIds.filter(id => ids.has(id));
  const next = [...retained, ...eligible.filter(p => !retained.includes(p.id)).map(p => p.id)].slice(0, MAX_ACTIVE);
  return { ...state, activeIds: next };
}
export function applyTrade(state: TrackerState, trade: Trade, filters: Filters): TrackerState {
  if (state.seen.includes(trade.id) || ![trade.amountUsd, trade.quantity, trade.priceUsd, trade.marketCap, trade.timestamp].every(Number.isFinite) ||
    trade.amountUsd <= 0 || trade.quantity <= 0 || trade.priceUsd <= 0 || trade.marketCap <= 0) return state;
  const id = positionId(trade.wallet, trade.mint);
  const oldToken = state.tokens[trade.mint];
  const token: Token = {
    mint: trade.mint, name: oldToken?.name ?? `Token ${trade.mint.slice(0, 4)}`, symbol: oldToken?.symbol ?? trade.mint.slice(0, 5),
    platform: trade.platform, image: oldToken?.image, estimated: !trade.demo,
    priceUsd: trade.priceUsd, marketCap: trade.marketCap, updatedAt: trade.timestamp,
    history: [...(oldToken?.history ?? []), trade.priceUsd].slice(-24),
  };
  let positions = state.positions.filter(p => p.id !== id);
  const previous = state.positions.find(p => p.id === id);
  if (trade.side === 'buy') {
    const position: Position = {
      id, wallet: trade.wallet, mint: trade.mint, demo: trade.demo,
      amountUsd: (previous?.amountUsd ?? 0) + trade.amountUsd,
      quantity: (previous?.quantity ?? 0) + trade.quantity,
      boughtAt: previous?.boughtAt ?? trade.timestamp,
    };
    // Keep existing queue order when an observed buyer adds to its position.
    if (previous) positions = state.positions.map(p => p.id === id ? position : p);
    else positions.push(position);
  }
  // Bounded session state: preserve active positions, then the newest candidates.
  if (positions.length > 200) {
    const active = positions.filter(p => state.activeIds.includes(p.id));
    positions = [...active, ...positions.filter(p => !state.activeIds.includes(p.id)).slice(-(200 - active.length))];
  }
  const relevant = trade.side === 'buy' && trade.amountUsd >= filters.minBuy && trade.amountUsd <= filters.maxBuy || !!previous;
  let next = reconcile({ ...state, positions, tokens: { ...state.tokens, [trade.mint]: token },
    events: relevant ? [{ id: trade.id, type: trade.side, wallet: trade.wallet, mint: trade.mint, amountUsd: trade.amountUsd, timestamp: trade.timestamp, demo: trade.demo }, ...state.events].slice(0, 80) : state.events,
    seen: [...state.seen, trade.id].slice(-2000), received: state.received + 1,
  }, filters);
  if (trade.side === 'sell' && state.activeIds.includes(id)) {
    const replacement = next.activeIds.find(active => !state.activeIds.includes(active));
    if (replacement) {
      const p = next.positions.find(p => p.id === replacement)!;
      next = { ...next, replacements: next.replacements + 1, events: [
        { id: `${trade.id}:replacement`, type: 'replace' as const, wallet: p.wallet, mint: p.mint, amountUsd: p.amountUsd, timestamp: trade.timestamp, demo: p.demo }, ...next.events,
      ].slice(0, 80) };
    }
  }
  // Keep token details for retained positions and recent events, bounded by the session.
  const keep = new Set([...next.positions.map(p => p.mint), ...next.events.map(e => e.mint)]);
  next.tokens = Object.fromEntries(Object.entries(next.tokens).filter(([mint]) => keep.has(mint)));
  return next;
}
export function activePositions(state: TrackerState) {
  return state.activeIds.map(id => state.positions.find(p => p.id === id)).filter((p): p is Position => !!p);
}
export function profit(position: Position, token: Token) {
  const usd = position.quantity * token.priceUsd - position.amountUsd;
  return { usd, percent: usd / position.amountUsd * 100 };
}
export function validateFilters(f: Filters): string | null {
  if (![f.minCap, f.maxCap, f.minBuy, f.maxBuy].every(Number.isFinite)) return 'Enter a number in every amount field.';
  if (f.minCap < 0 || f.maxCap <= 0) return 'Market caps must be positive. The minimum can be zero.';
  if (f.minCap > f.maxCap) return 'Maximum market cap must be at least the minimum.';
  if (f.minBuy < 50 || f.maxBuy > 500) return 'Keep buy amounts between $50 and $500.';
  if (f.minBuy > f.maxBuy) return 'Maximum buy amount must be at least the minimum.';
  return null;
}
export const money = (n: number, decimals = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
export function compactMoney(n: number) { return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n); }
export const shortAddress = (s: string) => s.length > 15 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
export function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
