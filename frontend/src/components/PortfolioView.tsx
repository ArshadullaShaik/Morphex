import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  LoaderCircle,
  RefreshCw,
  Droplets,
  TrendingUp,
  ShieldCheck,
  Lock,
  Layers,
  History,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { fetchPortfolioBalances } from '../morphex';
import { getUserPositions, getTotalUserLiquidityUSD, LiquidityPosition } from '../data/liquidityStore';
import { getAllMintedBalances, getMintTransactions, MintTransaction, ONRAMP_TOKEN_PRICES } from '../data/onRampStore';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';
import { MorphexLogo } from './MorphexLogo';

interface PortfolioViewProps {
  connectedWallet: string | null;
  onOpenWallet: () => void;
}

const KNOWN_CONFIDENTIAL_TOKENS: Record<string, Token> = {
  cUSDC: { symbol: 'cUSDC', name: 'USD Coin (Confidential)', address: '', decimals: 6, priceUSD: 1.0, verified: true, available: true, chain: 'Sepolia' },
  cUSDT: { symbol: 'cUSDT', name: 'Tether USD (Confidential)', address: '', decimals: 6, priceUSD: 1.0, verified: true, available: true, chain: 'Sepolia' },
  mUSD: { symbol: 'mUSD', name: 'Morphex USD', address: '', decimals: 6, priceUSD: 1.0, verified: true, available: true, chain: 'Morphex L2' },
  MORPH: { symbol: 'MORPH', name: 'Morphex Token', address: '', decimals: 6, priceUSD: 2.85, verified: true, available: true, chain: 'Morphex L2' },
};

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [userBalances, setUserBalances] = useState<Array<{ token: Token; balance: string }>>([]);
  const [confidentialBalances, setConfidentialBalances] = useState<Array<{ token: Token; balance: string }>>([]);
  const [userPositions, setUserPositions] = useState<LiquidityPosition[]>([]);
  const [mintedBalances, setMintedBalances] = useState<Record<string, number>>({});
  const [mintHistory, setMintHistory] = useState<MintTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const syncMinted = () => {
    setMintedBalances(getAllMintedBalances(connectedWallet));
    setMintHistory(getMintTransactions(connectedWallet));
  };

  const loadBalances = async () => {
    if (!connectedWallet) return;
    setIsLoading(true);
    setBalanceError(null);
    try {
      const result = await fetchPortfolioBalances(connectedWallet);
      setNativeBalance(result.nativeBalance);
      setUserBalances(
        result.tokenBalances.map(({ token, balance }) => ({
          token: { ...token, priceUSD: token.symbol === 'USDC' || token.symbol === 'USDT' ? 1 : 0 },
          balance,
        })),
      );
      setConfidentialBalances(
        result.confidentialBalances.map(({ token, balance }) => ({
          token: { ...token, priceUSD: token.symbol === 'cUSDC' || token.symbol === 'cUSDT' ? 1 : 0 },
          balance,
        })),
      );
      if (result.confidentialError) setBalanceError(result.confidentialError);
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : 'Could not load wallet balances.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncPositions = () => {
    setUserPositions(getUserPositions());
  };

  useEffect(() => {
    void loadBalances();
    syncPositions();
    syncMinted();

    const handleUpdate = () => {
      syncPositions();
      syncMinted();
    };
    const handleMinted = () => {
      syncMinted();
      void loadBalances();
    };

    const interval = window.setInterval(() => {
      void loadBalances();
    }, 20_000);

    window.addEventListener('liquidity-updated', handleUpdate);
    window.addEventListener('onramp-minted', handleMinted);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('liquidity-updated', handleUpdate);
      window.removeEventListener('onramp-minted', handleMinted);
    };
  }, [connectedWallet]);

  // Combine confidential balances with UPI minted token balances
  const effectiveConfidentialBalances: Array<{ token: Token; balance: string; mintedPortion: number }> = [];
  const handledSymbols = new Set<string>();

  for (const item of confidentialBalances) {
    const sym = item.token.symbol;
    handledSymbols.add(sym);
    const extraMinted = mintedBalances[sym] || 0;
    const totalBalance = (Number(item.balance) + extraMinted).toString();
    effectiveConfidentialBalances.push({
      token: {
        ...item.token,
        priceUSD: item.token.priceUSD || ONRAMP_TOKEN_PRICES[sym] || 1,
      },
      balance: totalBalance,
      mintedPortion: extraMinted,
    });
  }

  // Add any tokens minted via UPI that are not yet in on-chain confidential balances
  for (const [sym, rawAmount] of Object.entries(mintedBalances)) {
    const amount = Number(rawAmount);
    if (!handledSymbols.has(sym) && amount > 0) {
      const templateToken = KNOWN_CONFIDENTIAL_TOKENS[sym] || {
        symbol: sym,
        name: `${sym} Asset`,
        address: '',
        decimals: 6,
        priceUSD: ONRAMP_TOKEN_PRICES[sym] || 1,
        verified: true,
        available: true,
        chain: 'Sepolia',
      };
      effectiveConfidentialBalances.push({
        token: templateToken,
        balance: amount.toString(),
        mintedPortion: amount,
      });
    }
  }

  // Token balances total USD (standard ERC-20 + confidential + minted)
  const tokenBalancesUSD =
    userBalances.reduce((acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD, 0) +
    effectiveConfidentialBalances.reduce((acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD, 0);

  // Total liquidity deposited in pool positions USD
  const liquidityValueUSD = getTotalUserLiquidityUSD();

  // Total Portfolio Net Worth
  const totalNetWorthUSD = tokenBalancesUSD + liquidityValueUSD;

  // Confidential shielded value
  const confidentialShieldedValueUSD = effectiveConfidentialBalances.reduce(
    (acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD,
    0,
  );

  // Estimated Annual Yield (p.a.)
  const estAnnualYieldUSD = userPositions.reduce((sum, p) => {
    const rateNum = parseFloat(p.interestRate) || 18.4;
    return sum + p.valueUSD * (rateNum / 100);
  }, 0);

  // ── Disconnected Fallback View ──
  if (!connectedWallet) {
    return (
      <div id="dex-portfolio-disconnected" className="w-full max-w-md mx-auto py-12 text-center">
        <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-8 border border-white/80 shadow-[0_20px_50px_rgba(25,40,55,0.08)]">
          <div className="w-16 h-16 rounded-2xl bg-[#7342E2]/10 flex items-center justify-center mx-auto mb-4 text-[#7342E2]">
            <MorphexLogo variant="icon" theme="purple" size={36} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#192837] tracking-tight">Connect a wallet</h2>
          <p className="text-xs text-[#6B7280] mt-2 mb-6 max-w-xs mx-auto leading-relaxed">
            View your tokens, tracked confidential LP positions, and UPI minted assets across Ethereum and Zama FHEVM.
          </p>
          <button
            onClick={onOpenWallet}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-[#7342E2] hover:bg-[#6533D6] active:bg-[#5829B8] shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="dex-portfolio-view" className="w-full max-w-5xl mx-auto py-2 space-y-6">
      {/* ── Net Worth Overview Card ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl p-6 border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F3F4F6]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider">
                Total Net Worth
              </span>
              <span className="bg-[#ECFDF5] text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#10B981]" /> Live Portfolio
              </span>
              {confidentialShieldedValueUSD > 0 && (
                <span className="bg-[#7342E2]/10 text-[#7342E2] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Shielded: ${confidentialShieldedValueUSD.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-4xl font-extrabold text-[#192837] tracking-tight mt-1 font-mono">
              {isLoading ? (
                <LoaderCircle className="h-8 w-8 animate-spin text-[#7342E2]" />
              ) : (
                `$${totalNetWorthUSD.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-xs text-[#6B7280] mt-1 font-mono">
              {nativeBalance === null ? 'Wallet Connected' : `ETH Balance: ${Number(nativeBalance).toFixed(4)} ETH`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadBalances()}
              disabled={isLoading}
              aria-label="Refresh balances"
              className="p-2.5 rounded-xl border border-[#E5E7EB] hover:bg-gray-50 text-[#6B7280] hover:text-[#192837] transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#7342E2] hover:bg-[#6533D6] shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer">
              <ArrowDownLeft className="w-4 h-4" />
              <span>Receive</span>
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#192837] bg-white border border-[#E5E7EB] hover:bg-gray-50 shadow-xs transition-all active:scale-95 cursor-pointer">
              <ArrowUpRight className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>

        {/* ── 3 Metric Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Total Liquidity Value</span>
              <Droplets className="w-4 h-4 text-[#7342E2]" />
            </div>
            <div className="text-xl font-bold text-[#192837] font-mono">
              ${liquidityValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">Deposited in AMM pools</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0]">
            <div className="flex items-center justify-between text-xs text-[#047857] font-semibold mb-1">
              <span>Est. Annual Yield (p.a.)</span>
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-xl font-bold text-[#065F46] font-mono">
              +${estAnnualYieldUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr
            </div>
            <div className="text-[11px] text-[#047857] mt-1">Earned via confidential pools</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Confidential Shielded Value</span>
              <Lock className="w-4 h-4 text-[#7342E2]" />
            </div>
            <div className="text-xl font-bold text-[#7342E2] font-mono">
              ${confidentialShieldedValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#7342E2] mt-1">Zama FHEVM Encrypted</div>
          </div>
        </div>
      </div>

      {balanceError && (
        <p className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs font-semibold text-[#B91C1C]">
          {balanceError}
        </p>
      )}

      {/* ── Section 1: User Pool Liquidity Positions ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#7342E2]" />
            <h3 className="font-bold text-sm text-[#192837]">Your Liquidity Pool Positions</h3>
          </div>
          <span className="text-xs font-semibold text-[#047857] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
            {userPositions.length} Active Positions
          </span>
        </div>

        {userPositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No active pool liquidity positions found. Deposit tokens in the <strong>Pool</strong> section to earn yield!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Pool Pair</th>
                  <th className="py-3 px-5">Deposited Assets</th>
                  <th className="py-3 px-5">Position Value</th>
                  <th className="py-3 px-5">Interest Rate</th>
                  <th className="py-3 px-5">Privacy Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {userPositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-[#F9FAFB]/80 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center -space-x-2">
                          <TokenIcon symbol={pos.token0} size="md" />
                          <TokenIcon symbol={pos.token1} size="md" />
                        </div>
                        <div>
                          <span className="font-bold text-[#192837] text-xs">{pos.pairName}</span>
                          <div className="text-[10px] text-[#10B981] font-semibold">✓ Earning Yield</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 font-mono text-[#374151]">
                      {pos.amount0.toLocaleString()} {pos.token0} + {pos.amount1.toLocaleString()} {pos.token1}
                    </td>

                    <td className="py-4 px-5 font-bold text-[#192837] font-mono text-sm">
                      ${pos.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-4 px-5">
                      <span className="text-xs font-bold text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#A7F3D0]">
                        {pos.interestRate}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1 text-[#059669] font-semibold text-[11px]">
                        <Lock className="w-3.5 h-3.5" />
                        <span>FHE Encrypted</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Standard ERC-20 Asset Breakdown ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#192837]">Public Token Assets</h3>
          <span className="text-xs text-[#6B7280] font-mono">{userBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {userBalances.map((item) => (
            <div
              key={item.token.symbol}
              className="p-4 flex items-center justify-between hover:bg-[#F9FAFB]/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={item.token.symbol} size="md" />
                <div>
                  <div className="font-bold text-xs text-[#192837]">{item.token.name}</div>
                  <div className="text-[11px] text-[#6B7280] font-mono">
                    {Number(item.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.token.symbol}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-[#192837] font-mono">
                  ${(Number(item.balance) * item.token.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-[#6B7280]">
                  {item.token.priceUSD ? 'Estimated value' : 'Price unavailable'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Confidential & UPI Minted Assets ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#7342E2]" />
            <h3 className="font-bold text-sm text-[#192837]">Confidential & Shielded Assets</h3>
          </div>
          <span className="text-xs text-[#6B7280] font-mono">{effectiveConfidentialBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {effectiveConfidentialBalances.map((item) => (
            <div
              key={item.token.symbol}
              className="p-4 flex items-center justify-between hover:bg-[#F9FAFB]/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={item.token.symbol} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#192837]">{item.token.name}</span>
                    {item.mintedPortion > 0 && (
                      <span className="bg-[#ECFDF5] text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#A7F3D0]">
                        UPI Minted: +{item.mintedPortion.toFixed(4)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#6B7280] font-mono">
                    {Number(item.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} {item.token.symbol}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-[#192837] font-mono">
                  ${(Number(item.balance) * item.token.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-[#059669] flex items-center gap-1 justify-end font-semibold">
                  <Lock className="w-3 h-3" /> FHE Encrypted
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: UPI On-Ramp Mint Transactions Ledger ── */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/80 shadow-[0_16px_48px_rgba(25,40,55,0.06)] overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#7342E2]" />
            <h3 className="font-bold text-sm text-[#192837]">UPI Mint Ledger & Proof of Settlement</h3>
          </div>
          <span className="text-xs font-semibold text-[#7342E2] bg-[#7342E2]/10 px-2.5 py-1 rounded-full border border-[#7342E2]/20">
            {mintHistory.length} On-Ramp Records
          </span>
        </div>

        {mintHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No UPI on-ramp mints recorded yet. Go to <strong>Vault → UPI</strong> to scan the QR code and mint tokens to your wallet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB]/90 border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Date / Time</th>
                  <th className="py-3 px-5">Paid INR</th>
                  <th className="py-3 px-5">Minted Asset</th>
                  <th className="py-3 px-5">Ref ID</th>
                  <th className="py-3 px-5">Tx Hash</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {mintHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F9FAFB]/80 transition-colors">
                    <td className="py-4 px-5 text-[#6B7280] whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-5 font-bold text-[#192837] font-mono">
                      ₹{tx.amountInr.toLocaleString()} INR
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={tx.tokenSymbol} size="sm" />
                        <span className="font-bold text-[#047857] font-mono text-sm">
                          +{tx.tokenAmount.toFixed(4)} {tx.tokenSymbol}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-[#4B5563]">{tx.paymentId}</td>
                    <td className="py-4 px-5 font-mono text-[#6B7280]">
                      <span title={tx.txHash}>
                        {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold text-[#047857] border border-[#A7F3D0]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                        Minted
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
