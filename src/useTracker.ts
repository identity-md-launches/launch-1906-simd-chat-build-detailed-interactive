import { useCallback, useEffect, useRef, useState } from 'react';
import { createDemoState, demoStep, DEMO_TOKENS } from './demo';
import { applyTrade, DEFAULT_FILTERS, emptyState, reconcile, type FeedMode, type Filters } from './model';
import { connectLive, DEFAULT_RPC, fetchQuotes, SOL_MINT, type Connection, type MarketQuote } from './live';
function savedFilters(): Filters {
  try {
    const f = JSON.parse(localStorage.getItem('pulse.filters') ?? 'null');
    if (f && [f.minCap, f.maxCap, f.minBuy, f.maxBuy].every(Number.isFinite) && f.minCap >= 0 && f.maxCap >= f.minCap && f.maxCap > 0 && f.minBuy >= 50 && f.maxBuy <= 500 && f.minBuy <= f.maxBuy && ['all', 'pump.fun', 'Launchpad'].includes(f.platform)) return f;
  } catch { /* Browsers can deny storage; in-memory controls still work. */ }
  return DEFAULT_FILTERS;
}
export function useTracker() {
  const [filters, setFilters] = useState<Filters>(savedFilters);
  const filtersRef = useRef(filters);
  const [mode, setMode] = useState<FeedMode>('demo');
  const [state, setState] = useState(() => createDemoState(Date.now(), filters));
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [endpoint, setEndpoint] = useState(DEFAULT_RPC);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [quoteStatus, setQuoteStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [quotesAt, setQuotesAt] = useState(0);
  const solQuote = useRef<{ price: number; at: number } | null>(null);
  const step = useRef(0);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let busy = false;
    async function poll() {
      if (busy) return; busy = true;
      try {
        const result = await fetchQuotes([SOL_MINT, ...DEMO_TOKENS.map(t => t.mint)], AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]));
        if (controller.signal.aborted) return;
        const sol = result.find(q => q.mint === SOL_MINT);
        if (!sol) throw new Error('SOL quote missing');
        solQuote.current = { price: sol.price, at: Date.now() };
        setQuotes(result); setQuotesAt(Date.now()); setQuoteStatus('ready');
      } catch { if (!controller.signal.aborted) setQuoteStatus('error'); }
      finally { busy = false; }
    }
    void poll(); const timer = window.setInterval(poll, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [quoteAttempt]);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paused]);
  useEffect(() => {
    if (paused || mode !== 'demo') return;
    const timer = window.setInterval(() => { step.current++; const n = Date.now(); setState(s => demoStep(s, step.current, n, filtersRef.current)); }, 4500);
    return () => clearInterval(timer);
  }, [paused, mode]);
  useEffect(() => {
    if (mode !== 'live' || paused) return;
    // Every reconnect starts clean: sells missed during a gap cannot be inferred.
    setState(emptyState());
    return connectLive(endpoint, () => {
      const q = solQuote.current;
      return q && Date.now() - q.at < 90000 ? q.price : null;
    }, trade => { setState(s => applyTrade(s, trade, filtersRef.current)); }, (status, message) => {
      setConnection(status); setConnectionMessage(message);
    });
  }, [mode, paused, endpoint, attempt]);
  const applyFilters = useCallback((value: Filters) => {
    filtersRef.current = value; setFilters(value); setState(s => reconcile(s, value));
    try { localStorage.setItem('pulse.filters', JSON.stringify(value)); } catch { /* Persistence is optional. */ }
  }, []);
  function changeMode(value: FeedMode) {
    setMode(value); setPaused(false); setNow(Date.now()); step.current = 0;
    setState(value === 'demo' ? createDemoState(Date.now(), filtersRef.current) : emptyState());
  }
  return { state, filters, applyFilters, mode, changeMode, paused, setPaused, now, endpoint, setEndpoint,
    connection, connectionMessage, reconnect: () => setAttempt(v => v + 1),
    quotes, quoteStatus, quotesAt, retryQuotes: () => { setQuoteStatus('loading'); setQuoteAttempt(v => v + 1); } };
}
