import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Copy, X, ArrowUpRight } from 'lucide-react';
import { money, shortAddress, type Token } from './model';
export function Sparkline({ values, negative = false, large = false }: { values: number[]; negative?: boolean; large?: boolean }) {
  const width = large ? 560 : 110, height = large ? 150 : 36;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((v, i) => `${i / Math.max(1, values.length - 1) * width},${height - 5 - (v - min) / range * (height - 10)}`).join(' ');
  return <svg className={`sparkline ${negative ? 'negative' : ''} ${large ? 'large' : ''}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth={large ? 2 : 1.7} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>;
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const trigger = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); if (trigger?.isConnected) trigger.focus(); }; }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
    {children}
  </dialog>;
}
export function TokenAvatar({ token }: { token: Pick<Token, 'image' | 'name'> }) {
  return <span className="token-avatar">{token.image ? <img src={`./${token.image}`} alt="" width="36" height="36" /> : <span>{token.name.slice(0, 1)}</span>}</span>;
}
export function CopyButton({ value, label, copied, onCopy }: { value: string; label: string; copied: string; onCopy: (value: string, label: string) => void }) {
  return <button className={`copy-button ${copied === value ? 'copied' : ''}`} onClick={() => onCopy(value, label)} aria-label={`Copy ${label}`} title={`Copy ${label}: ${value}`}>
    {copied === value ? <Check size={15} /> : <Copy size={15} />}
  </button>;
}
export function Address({ value, label, copied, onCopy }: { value: string; label: string; copied: string; onCopy: (v: string, label: string) => void }) {
  return <div className="address-block"><span>{label}</span><div><code>{value}</code><CopyButton {...{ value, label, copied, onCopy }} /></div></div>;
}
export function MarketLink({ mint, children = 'View token on Solscan' }: { mint: string; children?: ReactNode }) {
  return <a className="external-link" href={`https://solscan.io/token/${encodeURIComponent(mint)}`} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15} /></a>;
}
export function SignedMoney({ value }: { value: number }) { return <>{value >= 0 ? '+' : '−'}{money(Math.abs(value))}</>; }
export { shortAddress };
