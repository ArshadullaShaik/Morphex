import React, { useState } from 'react';
import { ArrowDownToLine, CheckCircle2, LoaderCircle } from 'lucide-react';
import { deployedTokens } from '../morphex';
import { TokenIcon } from './TokenIcon';

export const OnRampView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [amount, setAmount] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState(deployedTokens.find((token) => token.symbol === 'cUSDC')?.symbol || deployedTokens[0]?.symbol || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const createPayment = () => {
    if (!connectedWallet) return onOpenWallet();
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    setMessage(null);
    window.setTimeout(() => {
      setBusy(false);
      setMessage(`Mock UPI payment verified for ${amount} INR. The relayer now acquires/reserves real ${tokenSymbol.replace(/^c/, '')} backing and mints ${tokenSymbol} to ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}.`);
      setAmount('');
    }, 700);
  };

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#047857]">Mock provider</div>
          <h2 className="text-base font-bold text-[#0D111C]">Enter with UPI</h2>
          <p className="mt-1 text-xs text-[#6B7280]">Pay INR through the local mock gateway. Settlement mints confidential crypto only.</p>
        </div>
        <ArrowDownToLine className="h-5 w-5 text-[#6B7280]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Amount in INR</label>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1,000" inputMode="decimal" className="w-full rounded-xl border border-[#E5E7EB] px-3 py-3 text-lg font-semibold focus:outline-none" />
        </div>
        <div className="w-[42%]">
          <label className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Receive</label>
          <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3">
            <TokenIcon symbol={tokenSymbol || 'cUSDC'} size="sm" />
            <select value={tokenSymbol} onChange={(event) => setTokenSymbol(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none">
              {deployedTokens.filter((token) => /cUSDC|cUSDT/.test(token.symbol)).map((token) => <option key={token.symbol} value={token.symbol}>{token.symbol}</option>)}
            </select>
          </div>
        </div>
      </div>
      <button onClick={createPayment} disabled={busy || !amount || deployedTokens.length === 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E5FF] py-3 text-sm font-bold text-[#0D111C] disabled:opacity-60">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
        Create UPI payment
      </button>
      {message && <p className="mt-3 flex gap-2 rounded-xl bg-[#ECFDF5] p-3 text-xs font-semibold text-[#065F46]"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
    </section>
  );
};
