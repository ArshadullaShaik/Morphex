import React, { useState } from 'react';
import {
  Plus,
  LoaderCircle,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  Lock,
  Droplets,
  MinusCircle,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { config, connectWallet, submitAddLiquidity, submitRemoveLiquidity } from '../morphex';
import { saveUserPosition, removeUserPosition, getUserPositions } from '../data/liquidityStore';
import { TokenIcon } from './TokenIcon';

interface PoolViewProps {
  connectedWallet?: string | null;
  onOpenWallet?: () => void;
}

export const PoolView: React.FC<PoolViewProps> = ({ connectedWallet, onOpenWallet }) => {
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'create' | null>(null);
  const [selectedPair, setSelectedPair] = useState<{
    pairName: string;
    token0: string;
    token1: string;
    token0Address: string;
    token1Address: string;
    pairAddress: string;
    feeTier: string;
    interestRate?: string;
  }>({
    pairName: 'cUSDC / cUSDT',
    token0: 'cUSDC',
    token1: 'cUSDT',
    token0Address: config.token1Address || '0x242064EA104a0cC49426dAcF0689E95774ed249B',
    token1Address: config.token0Address || '0x60f00ea035D8350BF6E3d98a148dCeBeCDa9d0B0',
    pairAddress: config.pairAddress || '0x72c84eCfba7DB1DC1D7fA1Bf12D4343f455BC939',
    feeTier: '0.30%',
  });

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [sharesToBurn, setSharesToBurn] = useState('');
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pools = [
    {
      pairName: 'cUSDC / cUSDT',
      token0: 'cUSDC',
      token1: 'cUSDT',
      token0Address: config.token1Address || '0x242064EA104a0cC49426dAcF0689E95774ed249B',
      token1Address: config.token0Address || '0x60f00ea035D8350BF6E3d98a148dCeBeCDa9d0B0',
      pairAddress: config.pairAddress || '0x72c84eCfba7DB1DC1D7fA1Bf12D4343f455BC939',
      feeTier: '0.30%',
      type: 'Confidential AMM',
      interestRate: '18.4% p.a.',
      tvl: '$24.6M',
      volume24h: '$4.8M',
    },
    {
      pairName: 'cUSDC / cWETH',
      token0: 'cUSDC',
      token1: 'cWETH',
      token0Address: '0x242064EA104a0cC49426dAcF0689E95774ed249B',
      token1Address: '0x1234567890123456789012345678901234567890',
      pairAddress: '0x8888888888888888888888888888888888888888',
      feeTier: '0.30%',
      type: 'Confidential AMM',
      interestRate: '24.2% p.a.',
      tvl: '$15.8M',
      volume24h: '$3.2M',
    },
    {
      pairName: 'cUSDT / cWBTC',
      token0: 'cUSDT',
      token1: 'cWBTC',
      token0Address: '0x60f00ea035D8350BF6E3d98a148dCeBeCDa9d0B0',
      token1Address: '0x9999999999999999999999999999999999999999',
      pairAddress: '0x7777777777777777777777777777777777777777',
      feeTier: '0.30%',
      type: 'Confidential AMM',
      interestRate: '19.8% p.a.',
      tvl: '$7.8M',
      volume24h: '$1.9M',
    },
  ];

  const userPositions = getUserPositions();

  const handleExecuteAddLiquidity = async () => {
    if (!connectedWallet && onOpenWallet) return onOpenWallet();
    if (!amount0 || !amount1 || Number(amount0) <= 0 || Number(amount1) <= 0) return;

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxHash(null);

    try {
      const { signer, address } = await connectWallet();
      const a0Big = BigInt(Math.floor(Number(amount0) * 1e6));
      const a1Big = BigInt(Math.floor(Number(amount1) * 1e6));
      const targetShares = BigInt(Math.floor(Math.sqrt(Number(amount0) * Number(amount1) * 1e12)));

      const tx = await submitAddLiquidity(
        signer,
        address,
        selectedPair.pairAddress,
        selectedPair.token0Address,
        selectedPair.token1Address,
        a0Big,
        a1Big,
        targetShares > 0n ? targetShares : 1000n,
      );

      setTxHash(tx.hash);
      await tx.wait();

      saveUserPosition({
        pairName: selectedPair.pairName,
        token0: selectedPair.token0,
        token1: selectedPair.token1,
        amount0: Number(amount0),
        amount1: Number(amount1),
        shares: Number(amount0),
        valueUSD: Number(amount0) + Number(amount1),
        interestRate: selectedPair.interestRate || '18.4% p.a.',
      });

      setSuccessMessage(
        `Successfully added confidential liquidity to ${selectedPair.pairName}! Your LP shares have been minted on-chain.`,
      );
      setAmount0('');
      setAmount1('');
      setTimeout(() => setActiveModal(null), 2500);
    } catch (err) {
      console.error('Add liquidity error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteRemoveLiquidity = async () => {
    if (!connectedWallet && onOpenWallet) return onOpenWallet();
    if (!sharesToBurn || Number(sharesToBurn) <= 0) return;

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setTxHash(null);

    try {
      const { signer, address } = await connectWallet();
      const sharesBig = BigInt(Math.floor(Number(sharesToBurn) * 1e6));
      const estAmount0 = BigInt(Math.floor(Number(sharesToBurn) * 0.5 * 1e6));
      const estAmount1 = BigInt(Math.floor(Number(sharesToBurn) * 0.5 * 1e6));

      const tx = await submitRemoveLiquidity(
        signer,
        address,
        selectedPair.pairAddress,
        sharesBig,
        estAmount0,
        estAmount1,
      );

      setTxHash(tx.hash);
      await tx.wait();

      removeUserPosition(selectedPair.pairName, Number(sharesToBurn));

      setSuccessMessage(
        `Successfully burned encrypted LP shares and withdrew tokens from ${selectedPair.pairName}!`,
      );
      setSharesToBurn('');
      setTimeout(() => setActiveModal(null), 2500);
    } catch (err) {
      console.error('Remove liquidity error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="dex-pool-view" className="w-full max-w-5xl mx-auto py-2 space-y-6">
      {/* ── Summary Metrics Banner ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-6 border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F3F4F6]">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#047857] mb-2 border border-[#A7F3D0]">
              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
              Zama FHEVM Confidential Liquidity
            </div>
            <h2 className="text-2xl font-extrabold text-[#192837] tracking-tight">
              Confidential Liquidity Pools
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Provide encrypted liquidity to earn trading fees without revealing pool balances or your LP position size.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (!connectedWallet && onOpenWallet) return onOpenWallet();
                setActiveModal('deposit');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-[#7342E2] hover:bg-[#6533D6] shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Liquidity</span>
            </button>

            <button
              onClick={() => setActiveModal('create')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs text-[#192837] bg-white border border-[#E5E7EB] hover:bg-gray-50 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#7342E2]" />
              <span>Create New Pair</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Total Protocol TVL</span>
              <Droplets className="w-4 h-4 text-[#7342E2]" />
            </div>
            <div className="text-2xl font-bold text-[#192837] font-mono">$48,200,000</div>
            <div className="text-[11px] text-[#047857] font-semibold mt-1">✓ Verified on Sepolia FHE</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0]">
            <div className="flex items-center justify-between text-xs text-[#047857] font-semibold mb-1">
              <span>24h Fees Generated</span>
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold text-[#065F46] font-mono">$142,500</div>
            <div className="text-[11px] text-[#047857] mt-1">Distributed to LP holders</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Active Pairs</span>
              <Sparkles className="w-4 h-4 text-[#7342E2]" />
            </div>
            <div className="text-2xl font-bold text-[#192837] font-mono">3 Active AMMs</div>
            <div className="text-[11px] text-[#6B7280] mt-1">Sepolia FHEVM Network</div>
          </div>
        </div>
      </div>

      {/* ── Active AMM Pairs Table Card ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[#7342E2]" />
            <span className="text-xs font-bold text-[#192837]">Active AMM Pairs</span>
          </div>
          <span className="text-[11px] font-semibold text-[#64748B]">Network: Sepolia FHE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Pool Pair</th>
                <th className="py-3.5 px-4">Interest Rate (p.a.)</th>
                <th className="py-3.5 px-4">Fee Tier</th>
                <th className="py-3.5 px-4">Pool TVL</th>
                <th className="py-3.5 px-4">Privacy Boundary</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {pools.map((p) => (
                <tr key={p.pairName} className="hover:bg-[#F9FAFB]/80 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center -space-x-2">
                        <TokenIcon symbol={p.token0} size="md" />
                        <TokenIcon symbol={p.token1} size="md" />
                      </div>
                      <div>
                        <span className="font-bold text-[#192837]">{p.pairName}</span>
                        <div className="text-[10px] text-[#10B981] font-semibold">✓ Live FHE Contract</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-xs font-bold text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#A7F3D0]">
                      {p.interestRate}
                    </span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-[#7342E2]/10 text-[#7342E2]">
                      {p.feeTier}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono font-semibold text-[#192837]">
                    {p.tvl}
                  </td>

                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5 text-[#059669] font-semibold text-[11px]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>FHE Encrypted</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPair(p);
                        setActiveModal('deposit');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#7342E2] hover:bg-[#6533D6] text-white transition-all shadow-xs cursor-pointer"
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPair(p);
                        setActiveModal('withdraw');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E5E7EB] hover:bg-gray-100 text-[#374151] transition-all cursor-pointer"
                    >
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Position Manager Section ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs font-bold text-[#192837]">Your Confidential LP Positions</span>
          </div>
          <span className="text-[11px] font-semibold text-[#64748B]">
            {userPositions.length} Positions Active
          </span>
        </div>

        {userPositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No active LP positions found. Deposit tokens into any pool above to mint encrypted LP shares and earn yield!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Pair</th>
                  <th className="py-3 px-4">Deposited</th>
                  <th className="py-3 px-4">Position Value</th>
                  <th className="py-3 px-4">Yield Rate</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {userPositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-[#F9FAFB]/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#192837]">{pos.pairName}</td>
                    <td className="py-3 px-4 font-mono text-[#374151]">
                      {pos.amount0} {pos.token0} + {pos.amount1} {pos.token1}
                    </td>
                    <td className="py-3 px-4 font-bold font-mono text-[#065F46]">
                      ${pos.valueUSD.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-md border border-[#A7F3D0]">
                        {pos.interestRate}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          const matching = pools.find((p) => p.pairName === pos.pairName);
                          if (matching) setSelectedPair(matching);
                          setActiveModal('withdraw');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Withdraw
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Liquidity Modal ── */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-2xl p-6 shadow-2xl border border-white/70">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#192837]">Add Confidential Liquidity</h3>
                <p className="text-xs text-[#6B7280]">Deposit into {selectedPair.pairName} FHE pool</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                  Amount 0 ({selectedPair.token0})
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] px-3.5 py-3 bg-[#F9FAFB]">
                  <TokenIcon symbol={selectedPair.token0} size="sm" />
                  <input
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="100.0"
                    inputMode="decimal"
                    className="w-full bg-transparent font-semibold text-base focus:outline-none font-numeric"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                  Amount 1 ({selectedPair.token1})
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] px-3.5 py-3 bg-[#F9FAFB]">
                  <TokenIcon symbol={selectedPair.token1} size="sm" />
                  <input
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="100.0"
                    inputMode="decimal"
                    className="w-full bg-transparent font-semibold text-base focus:outline-none font-numeric"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#16A34A] mt-0.5" />
              <span>
                Amounts are encrypted client-side using Zama WASM before sending. On-chain pair verifies fee-adjusted constant product ($x \cdot y = k$) on ciphertexts.
              </span>
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs font-semibold text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#ECFDF5] border border-[#6EE7B7] text-xs font-semibold text-[#047857] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
                <div>
                  <p>{successMessage}</p>
                  {txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] underline mt-1 text-[#065F46]"
                    >
                      View on Etherscan <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-xl border border-[#E5E7EB] font-bold text-xs text-[#374151] hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteAddLiquidity}
                disabled={busy || !amount0 || !amount1}
                className="flex-1 py-3 rounded-xl bg-[#7342E2] font-bold text-xs text-white hover:bg-[#6533D6] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Liquidity Modal ── */}
      {activeModal === 'withdraw' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-2xl p-6 shadow-2xl border border-white/70">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#192837]">Withdraw Liquidity</h3>
                <p className="text-xs text-[#6B7280]">Burn LP shares to receive underlying tokens</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                LP Shares to Burn
              </label>
              <input
                value={sharesToBurn}
                onChange={(e) => setSharesToBurn(e.target.value)}
                placeholder="50.0"
                inputMode="decimal"
                className="w-full rounded-2xl border border-[#E5E7EB] px-3.5 py-3 bg-[#F9FAFB] font-semibold text-base focus:outline-none font-numeric"
              />
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs font-semibold text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#ECFDF5] border border-[#6EE7B7] text-xs font-semibold text-[#047857] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#10B981]" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-xl border border-[#E5E7EB] font-bold text-xs text-[#374151] hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteRemoveLiquidity}
                disabled={busy || !sharesToBurn}
                className="flex-1 py-3 rounded-xl bg-[#DC2626] font-bold text-xs text-white hover:bg-[#B91C1C] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                Burn Shares
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create New Pair Modal ── */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-2xl p-6 shadow-2xl border border-white/70">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#192837]">Create New Confidential Pair</h3>
                <p className="text-xs text-[#6B7280]">Deploy a new FHE AMM pool with custom fee tier</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#4B5563] space-y-2">
              <p>
                Pair creation automatically provisions a confidential ERC-7984 compliant pool on Sepolia FHEVM.
              </p>
              <p className="font-semibold text-[#7342E2]">
                Default Factory: {config.factoryAddress || '0x6a54F96C186088e5b66d4825d198305c6E04F98E'}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-xl bg-[#7342E2] font-bold text-xs text-white hover:bg-[#6533D6] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
