import React, { useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, LoaderCircle, RefreshCw } from 'lucide-react';
import { fetchPortfolioBalances } from '../morphex';
import { Token } from '../types';
import { TokenIcon } from './TokenIcon';

interface PortfolioViewProps {
  connectedWallet: string | null;
  onOpenWallet: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [userBalances, setUserBalances] = useState<Array<{ token: Token; balance: string }>>([]);
  const [confidentialBalances, setConfidentialBalances] = useState<Array<{ token: Token; balance: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadBalances();
    const interval = window.setInterval(() => {
      void loadBalances();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [connectedWallet]);

  const totalPortfolioUSD = [...userBalances, ...confidentialBalances]
    .reduce((acc, curr) => acc + Number(curr.balance) * curr.token.priceUSD, 0);

  if (!connectedWallet) {
    return (
      <div id="dex-portfolio-disconnected" className="w-full max-w-md mx-auto py-8 text-center">
        <div className="bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4 text-[#6B7280]">
            <Wallet className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#0D111C]">Connect a wallet</h2>
          <p className="text-xs text-[#6B7280] mt-1.5 mb-6 max-w-xs mx-auto">
            View your tokens, tracked LP positions, and swap history across Ethereum and Layer 2s.
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
    <div id="dex-portfolio-view" className="w-full max-w-4xl mx-auto py-2">
      {/* Portfolio Top Balance Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#6B7280] font-medium">Total Balance</div>
          <div className="text-3xl font-bold text-[#0D111C] tracking-tight mt-1 font-mono">
            {isLoading ? <LoaderCircle className="h-7 w-7 animate-spin" /> : `$${totalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-[#6B7280] mt-1">{nativeBalance === null ? 'Wallet balance' : `${Number(nativeBalance).toFixed(4)} ETH`}</div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void loadBalances()} disabled={isLoading} aria-label="Refresh balances" className="p-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#0D111C] bg-[#00E5FF] hover:bg-[#00D2EA] shadow-sm transition-all">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Receive</span>
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#0D111C] border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-all">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>

      {balanceError && <p className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">{balanceError}</p>}

      {/* Asset breakdown table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0D111C]">Your Assets</h3>
          <span className="text-xs text-[#6B7280] font-mono">{userBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {userBalances.map((item) => {
            const change = item.token.change24h ?? 0;
            return (
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
            );
          })}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0D111C]">Confidential Assets</h3>
          <span className="text-xs text-[#6B7280] font-mono">{confidentialBalances.length} tokens</span>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {confidentialBalances.map((item) => (
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
                <div className="text-[11px] font-mono text-[#6B7280]">Encrypted balance</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
