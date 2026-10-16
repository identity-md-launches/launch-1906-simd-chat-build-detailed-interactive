import { applyTrade, emptyState, positionId, type Filters, type TrackerState, type Token } from './model';
// All transactions and valuations here are explicitly simulated. Mints are public token identifiers.
export const DEMO_TOKENS: Token[] = [
  { mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', name: 'Fartcoin', symbol: 'fartcoin', platform: 'pump.fun', priceUsd: .000284, marketCap: 284000, image: 'fartcoin.png', history: [18,20,19,23,22,26,24,29,27,32,31,37].map(x => x / 130000), updatedAt: 0 },
  { mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', name: 'Goatseus', symbol: 'goat', platform: 'pump.fun', priceUsd: .000672, marketCap: 672000, image: 'goat.png', history: [20,22,19,24,28,26,30,28,35,31,37,39].map(x => x / 58000), updatedAt: 0 },
  { mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', name: 'Moo Deng', symbol: 'moodeng', platform: 'pump.fun', priceUsd: .000128, marketCap: 128000, image: 'moodeng.png', history: [38,35,37,33,31,34,28,30,26,24,27,23].map(x => x / 180000), updatedAt: 0 },
  { mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', name: 'Chill guy', symbol: 'chillguy', platform: 'pump.fun', priceUsd: .000452, marketCap: 452000, image: 'chillguy.png', history: [21,23,22,26,25,27,26,31,33,30,37,40].map(x => x / 88000), updatedAt: 0 },
  { mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', name: 'Fwog', symbol: 'fwog', platform: 'pump.fun', priceUsd: .000086, marketCap: 86000, image: 'fwog.png', history: [30,32,29,31,28,25,28,24,25,22,24,23].map(x => x / 270000), updatedAt: 0 },
  { mint: '2kkwPP6Y5v4aSteLo2R6uqmx3aQ6Veb1xDcRXHsNbonk', name: 'Pnut', symbol: 'pnut', platform: 'Launchpad', priceUsd: .000318, marketCap: 318000, image: 'pnut.png', history: [20,19,22,24,23,25,28,26,30,33,32,36].map(x => x / 113000), updatedAt: 0 },
];
export function createDemoState(now: number, filters: Filters): TrackerState {
  let state = emptyState();
  state.tokens = Object.fromEntries(DEMO_TOKENS.map(t => [t.mint, { ...t, history: [...t.history], updatedAt: now }]));
  const amounts = [245, 180, 420, 95, 315, 150, 275, 85, 125, 350, 210, 480];
  const gains = [24.8, 18.6, -8.2, 32.4, -4.6, 12.8, 9.3, 16.2, 6.4, 11.2, -3.1, 23.5];
  for (let i = 0; i < 12; i++) {
    const token = DEMO_TOKENS[i % 6];
    const wallet = `Demo wallet ${String(i + 1).padStart(2, '0')}`;
    const time = now - (155 + i * 61) * 1000;
    const entry = token.priceUsd / (1 + gains[i] / 100);
    state = applyTrade(state, { id: `seed-${i}`, wallet, mint: token.mint, side: 'buy', amountUsd: amounts[i], quantity: amounts[i] / entry, priceUsd: token.priceUsd, marketCap: token.marketCap, timestamp: time, platform: token.platform, demo: true }, filters);
  }
  state.tokens = Object.fromEntries(DEMO_TOKENS.map(t => [t.mint, { ...t, history: [...t.history], updatedAt: now }]));
  return state;
}
export function demoStep(state: TrackerState, step: number, now: number, filters: Filters) {
  let next = { ...state, tokens: { ...state.tokens } };
  for (const [i, token] of Object.values(next.tokens).entries()) {
    const drift = 1 + Math.sin(step * .8 + i * 1.4) * .009;
    const priceUsd = token.priceUsd * drift;
    next.tokens[token.mint] = { ...token, priceUsd, marketCap: token.marketCap * drift, history: [...token.history, priceUsd].slice(-24), updatedAt: now };
  }
  const p = next.positions.find(p => next.activeIds.includes(p.id));
  if (step % 3 === 0 && p) {
    const token = next.tokens[p.mint];
    return applyTrade(next, { id: `demo-sell-${step}`, wallet: p.wallet, mint: p.mint, side: 'sell', amountUsd: p.quantity * token.priceUsd, quantity: p.quantity, priceUsd: token.priceUsd, marketCap: token.marketCap, timestamp: now, platform: token.platform, demo: true }, filters);
  }
  const template = DEMO_TOKENS[step % DEMO_TOKENS.length];
  const token = next.tokens[template.mint] ?? template;
  const amountUsd = 50 + (step * 73) % 451;
  const wallet = `Demo wallet ${String(step + 12).padStart(2, '0')}`;
  return applyTrade(next, { id: positionId(wallet, token.mint), wallet, mint: token.mint, side: 'buy', amountUsd, quantity: amountUsd / token.priceUsd, priceUsd: token.priceUsd, marketCap: token.marketCap, timestamp: now, platform: token.platform, demo: true }, filters);
}
