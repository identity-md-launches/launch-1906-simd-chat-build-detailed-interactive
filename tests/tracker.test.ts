import test from 'node:test';
import assert from 'node:assert/strict';
import { activePositions, applyTrade, DEFAULT_FILTERS, emptyState, profit, reconcile, validateFilters, type Trade } from '../src/model.ts';
import { createDemoState, demoStep } from '../src/demo.ts';
import { base58, decodeTrade, validateEndpoint } from '../src/live.ts';
const now = 1730000000000;
const trade = (i: number, extra: Partial<Trade> = {}): Trade => ({ id: `test-${i}`, wallet: `test-wallet-${i}`, mint: 'test-token', side: 'buy', amountUsd: 100, quantity: 100000, priceUsd: .001, marketCap: 50000, timestamp: now, platform: 'pump.fun', demo: true, ...extra });
test('inclusive buy and cap boundaries; invalid and reversed ranges rejected', () => {
  assert.equal(validateFilters(DEFAULT_FILTERS), null);
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, minBuy: 49 }));
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, maxBuy: 501 }));
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, minCap: 100, maxCap: 10 }));
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, maxCap: NaN }));
  let state = emptyState();
  for (const [i, amount] of [49,50,500,501].entries()) state = applyTrade(state, trade(i, { amountUsd: amount }), DEFAULT_FILTERS);
  assert.deepEqual(activePositions(state).map(p => p.amountUsd), [50,500]);
  assert.equal(reconcile(state, { ...DEFAULT_FILTERS, minCap: 50001 }).activeIds.length, 0);
  assert.equal(reconcile(state, { ...DEFAULT_FILTERS, minCap: 50000, maxCap: 50000 }).activeIds.length, 2);
});
test('a partial sell removes the position and replaces it with a queued qualifying buyer', () => {
  let state = emptyState();
  for (let i = 0; i < 10; i++) state = applyTrade(state, trade(i), DEFAULT_FILTERS);
  assert.equal(state.activeIds.length, 8);
  const first = state.activeIds[0];
  state = applyTrade(state, trade(0, { id: 'partial-sell', side: 'sell', quantity: 1, amountUsd: 1 }), DEFAULT_FILTERS);
  assert.ok(!state.positions.some(p => p.id === first));
  assert.equal(state.activeIds.length, 8);
  assert.ok(state.activeIds.includes('test-wallet-8:test-token'));
  assert.equal(state.replacements, 1);
  assert.equal(state.events[0].type, 'replace');
});
test('does not fabricate replacement when no candidate exists; deduplicates events', () => {
  const first = applyTrade(emptyState(), trade(1), DEFAULT_FILTERS);
  assert.strictEqual(applyTrade(first, trade(1), DEFAULT_FILTERS), first);
  const sold = applyTrade(first, trade(1, { id: 'sold', side: 'sell' }), DEFAULT_FILTERS);
  assert.equal(sold.activeIds.length, 0);
  assert.equal(sold.replacements, 0);
});
test('repeated buys aggregate cost and quantity without resetting the observed hold time', () => {
  let state = applyTrade(emptyState(), trade(1), DEFAULT_FILTERS);
  state = applyTrade(state, trade(1, { id:'second', amountUsd:200, quantity:100000, timestamp:now+10000 }), DEFAULT_FILTERS);
  const p = state.positions[0];
  assert.equal(p.amountUsd,300); assert.equal(p.quantity,200000); assert.equal(p.boughtAt,now);
  assert.equal(profit(p,state.tokens[p.mint]).usd,-100);
  state=applyTrade(state,trade(1,{id:'third',amountUsd:300}),DEFAULT_FILTERS);
  assert.equal(state.activeIds.length,0);
});
test('platform filter and deterministic demo sell events use the same tracking engine', () => {
  let state = createDemoState(now,DEFAULT_FILTERS);
  assert.equal(state.activeIds.length,8);
  const limited=reconcile(state,{...DEFAULT_FILTERS,platform:'Launchpad'});
  assert.ok(activePositions(limited).every(p=>limited.tokens[p.mint].platform==='Launchpad'));
  state=demoStep(state,3,now+4500,DEFAULT_FILTERS);
  assert.equal(state.replacements,1);
  assert.ok(state.events.some(e=>e.type==='sell'));
});
test('bounded queue, event history and seen cache', () => {
  let state=emptyState();
  for(let i=0;i<2100;i++) state=applyTrade(state,trade(i),DEFAULT_FILTERS);
  assert.equal(state.positions.length,200); assert.equal(state.events.length,80); assert.equal(state.seen.length,2000);
  assert.equal(state.activeIds.length,8);
});
test('decodes official Pump TradeEvent prefix and rejects malformed or non-SOL data', () => {
  const bytes=new Uint8Array(129); bytes.set([189,219,127,211,78,230,97,238]); bytes.fill(2,8,40); bytes.fill(3,57,89);
  const v=new DataView(bytes.buffer);
  v.setBigUint64(40,1_000_000_000n,true); v.setBigUint64(48,1_000_000_000_000n,true); bytes[56]=1;
  v.setBigInt64(89,BigInt(now/1000),true); v.setBigUint64(97,30_000_000_000n,true); v.setBigUint64(105,1_000_000_000_000_000n,true);
  const encode=()=>Buffer.from(bytes).toString('base64');
  const result=decodeTrade(encode(),'test-signature',4,100)!;
  assert.equal(result.side,'buy'); assert.equal(result.amountUsd,100); assert.equal(result.quantity,1_000_000); assert.ok(Math.abs(result.marketCap-3000)<.000001); assert.equal(result.timestamp,now); assert.equal(result.mint,base58(bytes.slice(8,40)));
  bytes[56]=0; assert.equal(decodeTrade(encode(),'sell',0,100)?.side,'sell');
  v.setBigUint64(40,0n,true); assert.equal(decodeTrade(encode(),'zero-sol',0,100),null);
  assert.equal(decodeTrade('bad','bad',0,100),null);
  assert.equal(base58(new Uint8Array(32)),'1'.repeat(32));
});
test('read-only endpoint validation rejects credentials and insecure connections',()=>{
  assert.equal(validateEndpoint('wss://api.mainnet-beta.solana.com'),true);
  for(const url of ['ws://example.com','https://example.com','wss://user:secret@example.com','wss://example.com?key=secret','wss://example.com#fragment']) assert.equal(validateEndpoint(url),false);
});

test('decodes a captured successful public mainnet TradeEvent', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/pump-trade.json', import.meta.url), 'utf8'));
  const decoded = decodeTrade(fixture.event, fixture.signature, 0, 100);
  assert.ok(decoded);
  assert.equal(decoded.amountUsd, Number(fixture.solLamports) / 1e9 * 100);
  assert.equal(decoded.quantity, Number(fixture.tokenBaseUnits) / 1e6);
  assert.equal(decoded.side, fixture.isBuy ? 'buy' : 'sell');
  assert.ok(decoded.wallet.length >= 32 && decoded.mint.length >= 32);
  assert.equal(decoded.demo, false);
});
