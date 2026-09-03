import React, { useState } from 'react';
import { Contract, parseUnits } from 'ethers';
import { ArrowUpRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { claimEscapedWithdrawal, connectWallet, deployedTokens, fetchWithdrawalRequest, submitConfidentialRedemption } from '../morphex';
import { TokenIcon } from './TokenIcon';

const decimalsAbi = ['function decimals() view returns (uint8)'];

export const RedemptionView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [selectedToken, setSelectedToken] = useState(deployedTokens[0]);
  const [amount, setAmount] = useState('');
  const [requestId, setRequestId] = useState<bigint | null>(null);
  const [request, setRequest] = useState<Awaited<ReturnType<typeof fetchWithdrawalRequest>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redeem = async () => {
    if (!connectedWallet) return onOpenWallet();
    if (!selectedToken || !amount) return;
    setBusy(true);
    setMessage(null);
    try {
      const { signer } = await connectWallet();
      const decimals = Number(await new Contract(selectedToken.address, decimalsAbi, signer).decimals());
      const units = parseUnits(amount, decimals);
      if (units <= 0n) throw new Error('Enter an amount greater than zero.');
      const result = await submitConfidentialRedemption(signer, connectedWallet, selectedToken.address, units);
      setRequestId(result.requestId);
      setRequest(await fetchWithdrawalRequest(result.requestId));
      setAmount('');
      setMessage(`Redemption request #${result.requestId.toString()} submitted. The relayer will release the matching ${selectedToken.symbol.replace(/^c/, '')} to this wallet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Redemption failed.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (requestId === null) return;
    setBusy(true);
    try {
      setRequest(await fetchWithdrawalRequest(requestId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read redemption status.');
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    if (!connectedWallet || requestId === null) return;
    setBusy(true);
    try {
      const { signer } = await connectWallet();
      await claimEscapedWithdrawal(signer, requestId);
      await refresh();
      setMessage('The escape-hatch claim released the real ERC-20 asset to your wallet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0D111C]">Redeem confidential crypto</h2>
          <p className="mt-1 text-xs text-[#6B7280]">Burn cUSDC or cUSDT and receive the corresponding real ERC-20 in this wallet.</p>
        </div>
        <ArrowUpRight className="h-5 w-5 text-[#6B7280]" />
      </div>
      {deployedTokens.length === 0 ? (
        <p className="rounded-xl bg-[#F9FAFB] p-3 text-xs font-semibold text-[#6B7280]">No confidential tokens are configured.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <TokenIcon symbol={selectedToken?.symbol || 'cUSDC'} size="lg" />
            <select
              value={selectedToken?.symbol || ''}
              onChange={(event) => setSelectedToken(deployedTokens.find((token) => token.symbol === event.target.value) || deployedTokens[0])}
              className="min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-sm font-semibold"
            >
              {deployedTokens.map((token) => <option key={token.symbol} value={token.symbol}>{token.symbol}</option>)}
            </select>
          </div>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-xl font-semibold focus:outline-none" />
          <button onClick={() => void redeem()} disabled={busy || !amount} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0D111C] py-3 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            Burn and redeem to wallet
          </button>
        </>
      )}
      {requestId !== null && request && (
        <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs text-[#374151]">
          <div className="flex items-center justify-between font-semibold"><span>Request #{requestId.toString()}</span><button onClick={() => void refresh()} disabled={busy} aria-label="Refresh redemption status"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button></div>
          <div className="mt-2">Status: {request.fulfilled ? (request.escaped ? 'Claimed by escape hatch' : 'Paid by relayer') : 'Awaiting relayer payout'}</div>
          {!request.fulfilled && <button onClick={() => void claim()} disabled={busy} className="mt-3 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 font-semibold disabled:opacity-60">Claim after escape delay</button>}
        </div>
      )}
      {message && <p className="mt-3 rounded-xl bg-[#F9FAFB] p-3 text-xs font-semibold text-[#374151]">{message}</p>}
    </section>
  );
};
