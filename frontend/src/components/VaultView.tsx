import React, { useState } from 'react';
import { Contract, JsonRpcSigner, parseUnits } from 'ethers';
import { ArrowDownToLine, LoaderCircle } from 'lucide-react';
import { publicTokens } from '../morphex';
import { connectWallet, config } from '../morphex';
import { TokenIcon } from './TokenIcon';

const erc20Abi = [
  'function approve(address spender,uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];
const vaultAbi = ['function deposit(address token,uint256 amount)'];

export const VaultView: React.FC<{ connectedWallet: string | null; onOpenWallet: () => void }> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [selected, setSelected] = useState(publicTokens[0]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const deposit = async () => {
    if (!connectedWallet) return onOpenWallet();
    if (!selected || !amount || !config.vaultAddress) return;
    setBusy(true);
    setMessage(null);
    try {
      const { signer } = await connectWallet();
      const code = await signer.provider.getCode(selected.address);
      if (code === '0x') {
        throw new Error(`No contract found for ${selected.symbol} on ${config.chainName}. Redeploy the local contracts and reload the app.`);
      }
      const token = new Contract(selected.address, erc20Abi, signer as JsonRpcSigner);
      const decimals = Number(await token.decimals());
      const units = parseUnits(amount, decimals);
      await (await token.approve(config.vaultAddress, units)).wait();
      await (await new Contract(config.vaultAddress, vaultAbi, signer).deposit(selected.address, units)).wait();
      setMessage(`Deposit confirmed. The relayer will mint c${selected.symbol} after confirmation.`);
      setAmount('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-[#0D111C]">Public token vault</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Deposit a public ERC-20 and receive its confidential wrapper from the relayer.</p>
      </div>
      <div className="bg-white rounded-3xl p-4 border border-[#E5E7EB] shadow-sm">
        <label className="block text-xs font-semibold text-[#6B7280] mb-2">Deposit token</label>
        <select
          value={selected?.symbol || ''}
          onChange={(event) => setSelected(publicTokens.find((token) => token.symbol === event.target.value) || publicTokens[0])}
          className="w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-3 text-sm font-semibold"
        >
          {publicTokens.map((token) => <option key={token.symbol} value={token.symbol}>{token.symbol}</option>)}
        </select>
        {selected && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F9FAFB] p-4">
            <TokenIcon symbol={selected.symbol} size="lg" />
            <div><div className="font-semibold">{selected.name}</div><div className="text-xs text-[#6B7280]">Public {selected.symbol} to confidential c{selected.symbol}</div></div>
          </div>
        )}
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" className="mt-3 w-full rounded-2xl border border-[#E5E7EB] px-4 py-4 text-2xl font-semibold focus:outline-none" />
        <button onClick={() => void deposit()} disabled={busy || !selected || !amount} className="mt-3 w-full rounded-2xl bg-[#00E5FF] py-3.5 font-bold disabled:opacity-60">
          {busy ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : <span className="flex items-center justify-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Deposit to vault</span>}
        </button>
        {message && <p className="mt-3 rounded-xl bg-[#F9FAFB] p-3 text-xs font-semibold text-[#374151]">{message}</p>}
      </div>
      <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 text-xs text-[#6B7280]">
        Withdrawal requests are created by burning confidential tokens. The relayer pays the matching public token after processing the request; the escape hatch remains available after its configured delay.
      </div>
    </div>
  );
};
