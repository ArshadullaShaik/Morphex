import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { POPULAR_TOKENS } from '../data/tokens';
import { TokenIcon } from './TokenIcon';

interface PortfolioViewProps {
  connectedWallet: string | null;
  onOpenWallet: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  connectedWallet,
  onOpenWallet,
}) => {
  const userBalances = [
    { token: POPULAR_TOKENS[0], balance: 3.45, valueUSD: 9384.0 },
    { token: POPULAR_TOKENS[1], balance: 4500.0, valueUSD: 4500.0 },
    { token: POPULAR_TOKENS[2], balance: 0.15, valueUSD: 9345.0 },
    { token: POPULAR_TOKENS[3], balance: 250.0, valueUSD: 2110.0 },
  ];

  const totalPortfolioUSD = userBalances.reduce((acc, curr) => acc + curr.valueUSD, 0);

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
            ${totalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#10B981] font-semibold mt-1 flex items-center gap-1">
            <span>+$428.40 (1.74%)</span>
            <span className="text-[#9CA3AF] font-normal">past 24h</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                    <div className="text-[11px] text-[#6B7280]">{item.balance} {item.token.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-xs text-[#0D111C] font-mono">${item.valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className={`text-[11px] font-mono ${change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {change >= 0 ? '+' : ''}{change}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
