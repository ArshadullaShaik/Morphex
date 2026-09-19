import React, { useState } from 'react';
import { Contract, parseUnits } from 'ethers';
import { ArrowUpRight, LoaderCircle, RefreshCw, Send, Wallet, Lock, ShieldCheck } from 'lucide-react';
import {
  claimEscapedWithdrawal,
  connectWallet,
  deployedTokens,
  fetchWithdrawalRequest,
  submitConfidentialRedemption,
} from '../morphex';
import { TokenIcon } from './TokenIcon';
import { WithdrawToAddressView } from './WithdrawToAddressView';

const decimalsAbi = ['function decimals() view returns (uint8)'];

type RedeemMode = 'self' | 'send';

export const RedemptionView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [mode, setMode] = useState<RedeemMode>('self');
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
      setMessage(
        `Redemption request #${result.requestId.toString()} submitted. The relayer will release the matching ${selectedToken.symbol.replace(/^c/, '')} to this wallet.`,
      );
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
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-2xl bg-white/80 p-1 border border-[#E5E7EB] shadow-xs">
        <button
          onClick={() => setMode('self')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'self'
              ? 'bg-[#7342E2] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#192837]'
          }`}
        >
          <Wallet className="h-3.5 w-3.5" />
          Redeem to self
        </button>
        <button
          onClick={() => setMode('send')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'send'
              ? 'bg-[#7342E2] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#192837]'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Send to address
        </button>
      </div>

      {/* Send to external address */}
      {mode === 'send' && (
        <WithdrawToAddressView connectedWallet={connectedWallet} onOpenWallet={onOpenWallet} />
      )}

      {/* Redeem to self */}
      {mode === 'self' && (
        <section className="rounded-3xl bg-white/90 backdrop-blur-2xl p-5 border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)]">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#192837]">Redeem Confidential Crypto</h2>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                Burn shielded tokens and unwrap the corresponding public ERC-20 to this wallet.
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#7342E2]/10 flex items-center justify-center text-[#7342E2]">
              <Lock className="h-4 w-4" />
            </div>
          </div>

          {deployedTokens.length === 0 ? (
            <p className="rounded-2xl bg-[#F9FAFB] p-4 text-xs font-semibold text-[#6B7280]">
              No confidential tokens are currently configured.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <TokenIcon symbol={selectedToken?.symbol || 'cUSDC'} size="lg" />
                <select
                  value={selectedToken?.symbol || ''}
                  onChange={(event) =>
                    setSelectedToken(
                      deployedTokens.find((token) => token.symbol === event.target.value) || deployedTokens[0],
                    )
                  }
                  className="min-w-0 flex-1 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3 text-sm font-bold text-[#192837] focus:outline-none focus:border-[#7342E2] cursor-pointer"
                >
                  {deployedTokens.map((token) => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol} — {token.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="mt-3.5 w-full rounded-2xl border border-[#E5E7EB] px-4 py-3.5 text-2xl font-extrabold text-[#192837] focus:outline-none focus:border-[#7342E2] font-numeric"
              />

              <button
                onClick={() => void redeem()}
                disabled={busy || !amount}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7342E2] hover:bg-[#6533D6] py-4 text-sm font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 cursor-pointer"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Burn and Redeem to Wallet
              </button>
            </>
          )}

          {requestId !== null && request && (
            <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs text-[#374151]">
              <div className="flex items-center justify-between font-bold text-[#192837]">
                <span>Request #{requestId.toString()}</span>
                <button
                  onClick={() => void refresh()}
                  disabled={busy}
                  aria-label="Refresh redemption status"
                  className="p-1 rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="mt-2 text-xs">
                Status:{' '}
                <span className="font-semibold text-[#7342E2]">
                  {request.fulfilled
                    ? request.escaped
                      ? 'Claimed via Escape Hatch'
                      : 'Settled by Relayer'
                    : 'Awaiting Relayer Confirmation'}
                </span>
              </div>
              {!request.fulfilled && (
                <button
                  onClick={() => void claim()}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#192837] hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
                >
                  Claim via Escape Delay
                </button>
              )}
            </div>
          )}

          {message && (
            <p className="mt-3.5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-3.5 text-xs font-semibold text-[#047857]">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
