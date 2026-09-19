import React, { useState } from 'react';
import { Contract, JsonRpcSigner, parseUnits } from 'ethers';
import { ArrowDownToLine, LoaderCircle, ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { publicTokens } from '../morphex';
import { connectWallet, config } from '../morphex';
import { TokenIcon } from './TokenIcon';

export const VaultView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [selected, setSelected] = useState(publicTokens[0]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const deposit = async () => {
    if (!connectedWallet) return onOpenWallet();
    if (!selected || !amount || !config.vaultAddress) return;
    setBusy(true);
    setMessage(null);
    setIsSuccess(false);
    try {
      const { signer } = await connectWallet();
      const code = await signer.provider.getCode(selected.address);
      if (code === '0x') {
        throw new Error(
          `No contract found for ${selected.symbol} on ${config.chainName}. Redeploy the local contracts and reload the app.`,
        );
      }
      const token = new Contract(
        selected.address,
        [
          'function approve(address spender,uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)',
        ],
        signer as JsonRpcSigner,
      );
      const decimals = Number(await token.decimals());
      const units = parseUnits(amount, decimals);
      await (await token.approve(config.vaultAddress, units)).wait();
      await (
        await new Contract(
          config.vaultAddress,
          ['function deposit(address token,uint256 amount)'],
          signer,
        ).deposit(selected.address, units)
      ).wait();
      setMessage(`Deposit confirmed. The relayer will mint c${selected.symbol} after confirmation.`);
      setIsSuccess(true);
      setAmount('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deposit failed.');
      setIsSuccess(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto space-y-4">
      <div className="mb-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#192837] tracking-tight">
          Public Token Vault
        </h1>
        <p className="mt-1.5 text-xs text-[#6B7280]">
          Wrap public ERC-20 tokens into shielded confidential tokens via the Zama KMS relayer.
        </p>
      </div>

      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-5 border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)]">
        <label className="block text-xs font-semibold text-[#6B7280] mb-2">Select Token to Shield</label>
        <select
          value={selected?.symbol || ''}
          onChange={(event) =>
            setSelected(publicTokens.find((token) => token.symbol === event.target.value) || publicTokens[0])
          }
          className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3 text-sm font-bold text-[#192837] focus:outline-none focus:border-[#7342E2] cursor-pointer"
        >
          {publicTokens.map((token) => (
            <option key={token.symbol} value={token.symbol}>
              {token.symbol} — {token.name}
            </option>
          ))}
        </select>

        {selected && (
          <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-[#F8FAFC] p-4 border border-[#E2E8F0]">
            <TokenIcon symbol={selected.symbol} size="lg" />
            <div>
              <div className="font-bold text-sm text-[#192837]">{selected.name}</div>
              <div className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
                <span>Public {selected.symbol}</span>
                <span>→</span>
                <span className="font-semibold text-[#7342E2] flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> Shielded c{selected.symbol}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">Deposit Amount</label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="w-full rounded-2xl border border-[#E5E7EB] px-4 py-3.5 text-2xl font-extrabold text-[#192837] focus:outline-none focus:border-[#7342E2] font-numeric"
          />
        </div>

        <button
          onClick={() => void deposit()}
          disabled={busy || !selected || !amount}
          className="mt-4 w-full rounded-2xl bg-[#7342E2] hover:bg-[#6533D6] active:bg-[#5829B8] py-4 font-bold text-sm text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60 cursor-pointer"
        >
          {busy ? (
            <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ArrowDownToLine className="h-4 w-4" /> Deposit to Vault
            </span>
          )}
        </button>

        {message && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              isSuccess
                ? 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]'
                : 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C]'
            }`}
          >
            {isSuccess ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-md p-4 text-xs text-[#6B7280] flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
        <span>
          Withdrawal requests are created by burning confidential tokens. The relayer unlocks matching public tokens after proof verification; an escape hatch remains available if delays occur.
        </span>
      </div>
    </div>
  );
};
