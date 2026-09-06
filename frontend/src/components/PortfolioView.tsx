import React, { useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, LoaderCircle, RefreshCw, Droplets, TrendingUp, ShieldCheck, Lock, Layers, History, Sparkles, CheckCircle2 } from 'lucide-react';
import { fetchPortfolioBalances } from '../morphex';
import { getUserPositions, getTotalUserLiquidityUSD, LiquidityPosition } from '../data/liquidityStore';
import { getAllMintedBalances, getMintTransactions, MintTransaction, ONRAMP_TOKEN_PRICES } from '../data/onRampStore';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';

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
      setUserBalances(result.tokenBalances.map(({ token, balance }) => ({
        token: { ...token, priceUSD: token.symbol === 'USDC' || token.symbol === 'USDT' ? 1 : 0 },
        balance,
      })));
      setConfidentialBalances(result.confidentialBalances.map(({ token, balance }) => ({
        token: { ...token, priceUSD: token.symbol === 'cUSDC' || token.symbol === 'cUSDT' ? 1 : 0 },
        balance,
      })));
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

    window.addEventListener('liquidity-updated', handleUpdate);
    window.addEventListener('onramp-minted', handleMinted);
    return () => {
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
  for (const [sym, amount] of Object.entries(mintedBalances)) {
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
  const tokenBalancesUSD = userBalances.reduce((acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD, 0)
    + effectiveConfidentialBalances.reduce((acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD, 0);

  // Total liquidity deposited in pool positions USD
  const liquidityValueUSD = getTotalUserLiquidityUSD();

  // Total Portfolio Net Worth
  const totalNetWorthUSD = tokenBalancesUSD + liquidityValueUSD;

  // Total value minted via UPI
  const totalMintedUSD = Object.entries(mintedBalances).reduce((sum, [sym, amt]) => {
    const price = ONRAMP_TOKEN_PRICES[sym] || 1.0;
    return sum + amt * price;
  }, 0);

  // Estimated Annual Yield (p.a.)
  const estAnnualYieldUSD = userPositions.reduce((sum, p) => {
    const rateNum = parseFloat(p.interestRate) || 18.4;
    return sum + (p.valueUSD * (rateNum / 100));
  }, 0);

  if (!connectedWallet) {
    return (
      <div id="dex-portfolio-disconnected" className="w-full max-w-md mx-auto py-8 text-center">
        <div className="bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4 text-[#6B7280]">
            <Wallet className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#0D111C]">Connect a wallet</h2>
          <p className="text-xs text-[#6B7280] mt-1.5 mb-6 max-w-xs mx-auto">
            View your tokens, tracked LP positions, and UPI minted assets across Ethereum and Layer 2s.
          </p>
          <button
            onClick={onOpenWallet}
            className="w-full py-3 rounded-xl font-bold text-sm text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] shadow-sm transition-all"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="dex-portfolio-view" className="w-full max-w-5xl mx-auto py-2 space-y-6">
      {/* Portfolio Header Dashboard Overview */}
      <div className="bg-white rounded-3xl p-6 border border-[#E5E7EB] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F3F4F6]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider">Net Worth Overview</span>
              <span className="bg-[#ECFDF5] text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#10B981]" /> Live Portfolio
              </span>
              {totalMintedUSD > 0 && (
                <span className="bg-[#E0F2FE] text-[#0284C7] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#00E5FF]" /> UPI Minted: +${totalMintedUSD.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-4xl font-extrabold text-[#0D111C] tracking-tight mt-1 font-mono">
              {isLoading ? <LoaderCircle className="h-8 w-8 animate-spin text-[#00E5FF]" /> : `$${totalNetWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {nativeBalance === null ? 'Wallet Connected' : `ETH Balance: ${Number(nativeBalance).toFixed(4)} ETH`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => void loadBalances()} 
              disabled={isLoading} 
              aria-label="Refresh balances" 
              className="p-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#6B7280] hover:text-[#0D111C] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] shadow-sm transition-all active:scale-95">
              <ArrowDownLeft className="w-4 h-4" />
              <span>Receive</span>
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0D111C] border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-all active:scale-95">
              <ArrowUpRight className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs text-[#64748B] font-medium mb-1">
              <span>Token Balance</span>
              <Wallet className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div className="text-xl font-bold text-[#0D111C] font-mono">
              ${tokenBalancesUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#6B7280] mt-1">
              Liquid & UPI minted tokens
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0]">
            <div className="flex items-center justify-between text-xs text-[#047857] font-semibold mb-1">
              <span>Liquidity Pool Value</span>
              <Droplets className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-xl font-bold text-[#065F46] font-mono">
              ${liquidityValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#047857] mt-1">Deposited in AMM pools</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD]">
            <div className="flex items-center justify-between text-xs text-[#0369A1] font-semibold mb-1">
              <span>Est. Annual Return (p.a.)</span>
              <TrendingUp className="w-4 h-4 text-[#0284C7]" />
            </div>
            <div className="text-xl font-bold text-[#0369A1] font-mono">
              +${estAnnualYieldUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr
            </div>
            <div className="text-[11px] text-[#0284C7] mt-1">Earned via pool interest rates</div>
          </div>
        </div>
      </div>

      {balanceError && <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">{balanceError}</p>}

      {/* Section 1: User Pool Liquidity Positions */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00E5FF]" />
            <h3 className="font-bold text-sm text-[#0D111C]">Your Liquidity Pool Positions</h3>
          </div>
          <span className="text-xs font-semibold text-[#047857] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
            {userPositions.length} Active Positions
          </span>
        </div>

        {userPositions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7280]">
            No active pool liquidity positions found. Deposit tokens in the <strong>Pool</strong> section to earn per annum interest!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
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
                  <tr key={pos.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center -space-x-2">
                          <TokenIcon symbol={pos.token0} size="md" />
                          <TokenIcon symbol={pos.token1} size="md" />
                        </div>
                        <div>
                          <span className="font-bold text-[#0D111C] text-xs">{pos.pairName}</span>
                          <div className="text-[10px] text-[#10B981] font-semibold">✓ Earning Interest</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 font-mono text-[#374151]">
                      {pos.amount0.toLocaleString()} {pos.token0} + {pos.amount1.toLocaleString()} {pos.token1}
                    </td>

                    <td className="py-4 px-5 font-bold text-[#0D111C] font-mono text-sm">
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

      {/* Section 2: Standard ERC-20 Asset Breakdown */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0D111C]">Liquid Token Assets</h3>
          <span className="text-xs text-[#6B7280] font-mono">{userBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {userBalances.map((item) => (
            <div key={item.token.symbol} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center gap-3">
                <TokenIcon symbol={item.token.symbol} size="md" />
                <div>
                  <div className="font-semibold text-xs text-[#0D111C]">{item.token.name}</div>
                  <div className="text-[11px] text-[#6B7280]">{Number(item.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.token.symbol}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-xs text-[#0D111C] font-mono">${(Number(item.balance) * item.token.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-[11px] font-mono text-[#6B7280]">{item.token.priceUSD ? 'Estimated value' : 'Price unavailable'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Confidential & UPI Minted Assets */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#00E5FF]" />
            <h3 className="font-bold text-sm text-[#0D111C]">Confidential & UPI Minted Assets</h3>
          </div>
          <span className="text-xs text-[#6B7280] font-mono">{effectiveConfidentialBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {effectiveConfidentialBalances.map((item) => (
            <div key={item.token.symbol} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center gap-3">
                <TokenIcon symbol={item.token.symbol} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#0D111C]">{item.token.name}</span>
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
                <div className="font-semibold text-xs text-[#0D111C] font-mono">
                  ${(Number(item.balance) * item.token.priceUSD).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-[#059669] flex items-center gap-1 justify-end">
                  <Lock className="w-3 h-3" /> FHE Encrypted
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: UPI On-Ramp Mint Transactions Ledger */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#00E5FF]" />
            <h3 className="font-bold text-sm text-[#0D111C]">UPI Mint Ledger & Proof of Settlement</h3>
          </div>
          <span className="text-xs font-semibold text-[#0369A1] bg-[#E0F2FE] px-2.5 py-1 rounded-full border border-[#BAE6FD]">
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
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Date / Time</th>
                  <th className="py-3 px-5">Paid INR</th>
                  <th className="py-3 px-5">Minted Asset</th>
                  <th className="py-3 px-5">Razorpay Ref ID</th>
                  <th className="py-3 px-5">On-Chain Tx Hash</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {mintHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-4 px-5 text-[#6B7280] whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-4 px-5 font-bold text-[#0D111C] font-mono">
                      ₹{tx.amountInr.toLocaleString()} INR
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={tx.tokenSymbol} size="sm" />
                        <span className="font-bold text-[#047857] font-mono text-sm">+{tx.tokenAmount.toFixed(4)} {tx.tokenSymbol}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-[#4B5563]">
                      {tx.paymentId}
                    </td>
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

